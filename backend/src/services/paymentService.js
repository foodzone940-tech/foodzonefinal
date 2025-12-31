import Razorpay from 'razorpay';
import crypto from 'crypto';
import { query, transaction } from '../config/database.js';

class PaymentService {
  constructor() {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    }
  }

  async createOrder(orderId, amount) {
    try {
      if (!this.razorpay) {
        throw new Error('Razorpay not configured');
      }

      const options = {
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `order_${orderId}`,
        notes: {
          order_id: orderId
        }
      };

      const razorpayOrder = await this.razorpay.orders.create(options);

      await query(
        `INSERT INTO payment_transactions (order_id, transaction_id, payment_method, amount, status)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, razorpayOrder.id, 'razorpay', amount, 'pending']
      );

      return {
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      throw error;
    }
  }

  verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return generated_signature === razorpaySignature;
  }

  async verifyPayment(orderId, paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

      const isValid = this.verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        await query(
          `UPDATE payment_transactions
           SET status = 'failed'
           WHERE transaction_id = ?`,
          [razorpay_order_id]
        );

        return { success: false, message: 'Payment verification failed' };
      }

      await transaction(async (conn) => {
        await conn.execute(
          `UPDATE payment_transactions
           SET status = 'success'
           WHERE transaction_id = ?`,
          [razorpay_order_id]
        );

        await conn.execute(
          `UPDATE orders
           SET payment_status = 'PAID', transaction_id = ?, order_status = 'PLACED'
           WHERE id = ?`,
          [razorpay_payment_id, orderId]
        );

        await conn.execute(
          `INSERT INTO order_status_history (order_id, status)
           VALUES (?, ?)`,
          [orderId, 'PLACED']
        );
      });

      return {
        success: true,
        message: 'Payment verified and order confirmed',
        paymentId: razorpay_payment_id
      };
    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  async handleWebhook(signature, payload) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        return { success: false, message: 'Invalid webhook signature' };
      }

      const event = payload?.event;
      const paymentEntity = payload?.payload?.payment?.entity;

      if (!event || !paymentEntity) {
        return { success: false, message: 'Invalid webhook payload' };
      }

      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      if (event === 'payment.captured') {
        await transaction(async (conn) => {
          const [rows] = await conn.execute(
            'SELECT order_id FROM payment_transactions WHERE transaction_id = ? LIMIT 1',
            [razorpayOrderId]
          );
          if (!rows || rows.length === 0) return;

          const orderId = rows[0].order_id;

          // Single source of truth: if order already has a SUCCESS transaction, ignore webhook
          const [succ] = await conn.execute(
            "SELECT id, transaction_id FROM payment_transactions WHERE order_id = ? AND status = 'success' LIMIT 1",
            [orderId]
          );
          if (succ && succ.length > 0) return;

          try {
            await conn.execute(
              `UPDATE payment_transactions
               SET status = 'success'
               WHERE transaction_id = ?`,
              [razorpayOrderId]
            );
          } catch (e) {
            // DB constraint safety: ignore duplicates (idempotent)
            if (e && e.code === 'ER_DUP_ENTRY') return;
            throw e;
          }

          const [oRows] = await conn.execute(
            'SELECT payment_status, order_status FROM orders WHERE id = ? LIMIT 1',
            [orderId]
          );
          const currentPaymentStatus = oRows?.[0]?.payment_status;
          const currentOrderStatus = oRows?.[0]?.order_status;

          if (currentPaymentStatus !== 'PAID') {
            // Don't downgrade order status (e.g., DELIVERED -> PLACED)
            if (!currentOrderStatus || currentOrderStatus === 'PENDING') {
              await conn.execute(
                `UPDATE orders
                 SET payment_status = 'PAID', transaction_id = ?, order_status = 'PLACED'
                 WHERE id = ?`,
                [razorpayPaymentId, orderId]
              );

              await conn.execute(
                `INSERT INTO order_status_history (order_id, status)
                 SELECT ?, 'PLACED'
                 WHERE NOT EXISTS (
                   SELECT 1 FROM order_status_history WHERE order_id = ? AND status = 'PLACED'
                 )`,
                [orderId, orderId]
              );
            } else {
              await conn.execute(
                `UPDATE orders
                 SET payment_status = 'PAID', transaction_id = ?
                 WHERE id = ?`,
                [razorpayPaymentId, orderId]
              );
            }
          }
        });
      } else if (event === 'payment.failed') {
        await transaction(async (conn) => {
          const [rows] = await conn.execute(
            'SELECT order_id FROM payment_transactions WHERE transaction_id = ? LIMIT 1',
            [razorpayOrderId]
          );
          if (!rows || rows.length === 0) return;

          const orderId = rows[0].order_id;

          await conn.execute(
            `UPDATE payment_transactions
             SET status = 'failed'
             WHERE transaction_id = ?`,
            [razorpayOrderId]
          );

          // Do not override a PAID or DELIVERED order
          await conn.execute(
            `UPDATE orders
             SET payment_status = 'FAILED', order_status = 'CANCELLED'
             WHERE id = ? AND payment_status <> 'PAID' AND order_status <> 'DELIVERED'`,
            [orderId]
          );
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  async processRefund(orderId, amount, reason) {
    try {
      const [order] = await query(
        'SELECT transaction_id FROM orders WHERE id = ?',
        [orderId]
      );

      if (!order || !order.transaction_id) {
        throw new Error('Payment transaction not found');
      }

      if (this.razorpay) {
        const refund = await this.razorpay.payments.refund(order.transaction_id, {
          amount: Math.round(amount * 100),
          notes: { reason }
        });

        await transaction(async (conn) => {
          await conn.execute(
            `INSERT INTO refund_history (order_id, refund_amount, refund_reason, status)
             VALUES (?, ?, ?, 'processed')`,
            [orderId, amount, reason]
          );

          await conn.execute(
            `UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?`,
            [orderId]
          );

          await conn.execute(
            `UPDATE payment_transactions SET status = 'refunded' WHERE order_id = ?`,
            [orderId]
          );
        });

        return { success: true, refundId: refund.id };
      }

      throw new Error('Razorpay not configured');
    } catch (error) {
      console.error('Refund processing error:', error);
      throw error;
    }
  }
}

export default new PaymentService();
