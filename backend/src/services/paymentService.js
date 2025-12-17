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

      const event = payload.event;
      const paymentEntity = payload.payload.payment.entity;

      if (event === 'payment.captured') {
        await transaction(async (conn) => {
          const [txn] = await conn.execute(
            'SELECT order_id FROM payment_transactions WHERE transaction_id = ?',
            [paymentEntity.order_id]
          );

          if (txn) {
            await conn.execute(
              `UPDATE payment_transactions
               SET status = 'success'
               WHERE transaction_id = ?`,
              [paymentEntity.order_id]
            );

            await conn.execute(
              `UPDATE orders
               SET payment_status = 'PAID', transaction_id = ?, order_status = 'PLACED'
               WHERE id = ?`,
              [paymentEntity.id, txn.order_id]
            );

            await conn.execute(
              `INSERT INTO order_status_history (order_id, status)
               VALUES (?, ?)`,
              [txn.order_id, 'PLACED']
            );
          }
        });
      } else if (event === 'payment.failed') {
        await query(
          `UPDATE payment_transactions
           SET status = 'failed'
           WHERE transaction_id = ?`,
          [paymentEntity.order_id]
        );

        await query(
          `UPDATE orders
           SET payment_status = 'FAILED', order_status = 'CANCELLED'
           WHERE id = (SELECT order_id FROM payment_transactions WHERE transaction_id = ?)`,
          [paymentEntity.order_id]
        );
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
