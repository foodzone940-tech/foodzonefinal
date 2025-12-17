import axios from 'axios';
import { query } from '../config/database.js';

class OTPService {
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendViaSMS2(phone, otp) {
    try {
      const apiKey = process.env.FAST2SMS_API_KEY;

      if (!apiKey) {
        throw new Error('Fast2SMS API key not configured');
      }

      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'v3',
          sender_id: 'FODZNE',
          message: `Your FoodZone OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
          language: 'english',
          flash: 0,
          numbers: phone
        },
        {
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.return;
    } catch (error) {
      console.error('Fast2SMS error:', error.response?.data || error.message);
      throw new Error('Failed to send OTP via Fast2SMS');
    }
  }

  async sendViaTwilio(phone, otp) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioNumber) {
        throw new Error('Twilio credentials not configured');
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const response = await axios.post(
        url,
        new URLSearchParams({
          To: phone,
          From: twilioNumber,
          Body: `Your FoodZone OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`
        }),
        {
          auth: {
            username: accountSid,
            password: authToken
          }
        }
      );

      return response.data.sid !== undefined;
    } catch (error) {
      console.error('Twilio error:', error.response?.data || error.message);
      throw new Error('Failed to send OTP via Twilio');
    }
  }

  async sendOTP(phone, userId) {
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      let sent = false;

      if (process.env.FAST2SMS_API_KEY) {
        sent = await this.sendViaSMS2(phone, otp);
      } else if (process.env.TWILIO_ACCOUNT_SID) {
        sent = await this.sendViaTwilio(phone, otp);
      } else {
        console.log(`📱 OTP for ${phone}: ${otp} (Demo mode - configure SMS provider)`);
        sent = true;
      }

      if (sent) {
        await query(
          `INSERT INTO otp_verification (user_id, otp_code, expires_at, verified)
           VALUES (?, ?, ?, 0)`,
          [userId, otp, expiresAt]
        );

        await query(
          `INSERT INTO api_logs (endpoint, request_method, request_data, ip_address, response_status)
           VALUES (?, ?, ?, ?, ?)`,
          ['/otp/send', 'POST', JSON.stringify({ phone, userId }), 'system', 200]
        );

        return { success: true, message: 'OTP sent successfully' };
      }

      throw new Error('Failed to send OTP');
    } catch (error) {
      console.error('OTP send error:', error);
      throw error;
    }
  }

  async verifyOTP(userId, otpCode) {
    try {
      const [otpRecord] = await query(
        `SELECT * FROM otp_verification
         WHERE user_id = ? AND otp_code = ? AND verified = 0 AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId, otpCode]
      );

      if (!otpRecord) {
        return { success: false, message: 'Invalid or expired OTP' };
      }

      await query(
        'UPDATE otp_verification SET verified = 1 WHERE id = ?',
        [otpRecord.id]
      );

      return { success: true, message: 'OTP verified successfully' };
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  }
}

export default new OTPService();
