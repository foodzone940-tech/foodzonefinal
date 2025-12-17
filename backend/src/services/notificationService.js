import admin from 'firebase-admin';
import { query } from '../config/database.js';

class NotificationService {
  constructor() {
    this.initialized = false;
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        const serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });

        this.initialized = true;
        console.log('✅ Firebase Admin initialized for notifications');
      } else {
        console.warn('⚠️  Firebase credentials not configured. Push notifications disabled.');
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  async sendToUser(userId, title, message, data = {}) {
    try {
      const tokens = await query(
        'SELECT token FROM push_tokens WHERE user_id = ?',
        [userId]
      );

      if (tokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return { success: false, message: 'No device tokens found' };
      }

      const tokenList = tokens.map(t => t.token);

      await query(
        `INSERT INTO notifications (user_id, title, message, is_read)
         VALUES (?, ?, ?, 0)`,
        [userId, title, message]
      );

      if (this.initialized) {
        const payload = {
          notification: {
            title,
            body: message
          },
          data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          }
        };

        const response = await admin.messaging().sendToDevice(tokenList, payload);

        return {
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount
        };
      }

      console.log(`📧 Notification for user ${userId}: ${title} - ${message}`);
      return { success: true, message: 'Notification saved (FCM not configured)' };
    } catch (error) {
      console.error('Notification send error:', error);
      throw error;
    }
  }

  async sendToVendor(vendorId, title, message, data = {}) {
    try {
      const tokens = await query(
        'SELECT token FROM push_tokens WHERE vendor_id = ?',
        [vendorId]
      );

      if (tokens.length === 0) {
        console.log(`No push tokens found for vendor ${vendorId}`);
        return { success: false, message: 'No device tokens found' };
      }

      const tokenList = tokens.map(t => t.token);

      if (this.initialized) {
        const payload = {
          notification: {
            title,
            body: message
          },
          data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          }
        };

        const response = await admin.messaging().sendToDevice(tokenList, payload);

        return {
          success: true,
          successCount: response.successCount,
          failureCount: response.failureCount
        };
      }

      console.log(`📧 Notification for vendor ${vendorId}: ${title} - ${message}`);
      return { success: true, message: 'Notification sent (FCM not configured)' };
    } catch (error) {
      console.error('Vendor notification send error:', error);
      throw error;
    }
  }

  async sendOrderNotification(orderId, status) {
    try {
      const [order] = await query(
        `SELECT o.*, u.name as user_name, v.vendor_name
         FROM orders o
         JOIN users u ON o.user_id = u.id
         JOIN vendors v ON o.vendor_id = v.id
         WHERE o.id = ?`,
        [orderId]
      );

      if (!order) return;

      const statusMessages = {
        'PLACED': {
          user: { title: 'Order Placed', message: 'Your order has been placed successfully!' },
          vendor: { title: 'New Order', message: `New order #${orderId} from ${order.user_name}` }
        },
        'ACCEPTED': {
          user: { title: 'Order Accepted', message: `${order.vendor_name} is preparing your order` },
          vendor: null
        },
        'PREPARING': {
          user: { title: 'Order in Progress', message: 'Your order is being prepared' },
          vendor: null
        },
        'READY': {
          user: { title: 'Order Ready', message: 'Your order is ready for pickup/delivery' },
          vendor: null
        },
        'DELIVERED': {
          user: { title: 'Order Delivered', message: 'Your order has been delivered. Enjoy!' },
          vendor: { title: 'Order Completed', message: `Order #${orderId} marked as delivered` }
        },
        'CANCELLED': {
          user: { title: 'Order Cancelled', message: 'Your order has been cancelled' },
          vendor: { title: 'Order Cancelled', message: `Order #${orderId} was cancelled` }
        }
      };

      const messages = statusMessages[status];

      if (messages) {
        if (messages.user) {
          await this.sendToUser(order.user_id, messages.user.title, messages.user.message, {
            type: 'order_update',
            order_id: orderId.toString(),
            status
          });
        }

        if (messages.vendor) {
          await this.sendToVendor(order.vendor_id, messages.vendor.title, messages.vendor.message, {
            type: 'order_update',
            order_id: orderId.toString(),
            status
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Order notification error:', error);
      throw error;
    }
  }

  async sendPaymentNotification(orderId, status) {
    try {
      const [order] = await query(
        'SELECT user_id, total_amount FROM orders WHERE id = ?',
        [orderId]
      );

      if (!order) return;

      if (status === 'success') {
        await this.sendToUser(
          order.user_id,
          'Payment Successful',
          `Payment of ₹${order.total_amount} confirmed for order #${orderId}`,
          {
            type: 'payment_update',
            order_id: orderId.toString(),
            status
          }
        );
      } else if (status === 'failed') {
        await this.sendToUser(
          order.user_id,
          'Payment Failed',
          `Payment failed for order #${orderId}. Please try again.`,
          {
            type: 'payment_update',
            order_id: orderId.toString(),
            status
          }
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Payment notification error:', error);
      throw error;
    }
  }

  async registerDeviceToken(userId, vendorId, token, deviceType = 'android') {
    try {
      const existingToken = await query(
        'SELECT id FROM push_tokens WHERE token = ?',
        [token]
      );

      if (existingToken.length > 0) {
        await query(
          'UPDATE push_tokens SET user_id = ?, vendor_id = ?, device_type = ? WHERE token = ?',
          [userId, vendorId, deviceType, token]
        );
      } else {
        await query(
          `INSERT INTO push_tokens (user_id, vendor_id, token, device_type)
           VALUES (?, ?, ?, ?)`,
          [userId, vendorId, token, deviceType]
        );
      }

      return { success: true, message: 'Device token registered' };
    } catch (error) {
      console.error('Device token registration error:', error);
      throw error;
    }
  }
}

export default new NotificationService();
