# Complete Setup Guide - FoodZone

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [OTP Service Configuration](#otp-service-configuration)
3. [Payment Gateway Setup](#payment-gateway-setup)
4. [Push Notifications Setup](#push-notifications-setup)
5. [Testing the Application](#testing-the-application)
6. [Production Deployment](#production-deployment)

## Local Development Setup

### Step 1: Install Dependencies

```bash
# Check Node.js version (should be 16+)
node --version

# Check MySQL
mysql --version
```

### Step 2: Database Import

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE u816290961_foodzone_db;

# Exit MySQL
EXIT;

# Import schema
mysql -u root -p u816290961_foodzone_db < u816290961_foodzone_db.sql
```

### Step 3: Backend Configuration

```bash
cd backend
npm install

# Copy environment file
cp .env.example .env
```

Edit `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=u816290961_foodzone_db
```

### Step 4: Start Development Server

```bash
# Start backend
cd backend
npm start

# You should see:
# ✅ Database connected successfully
# 📡 Server running on port: 5000
```

### Step 5: Open Frontend

Open `frontend-user/index.html` in your browser using:
- Live Server (VS Code extension)
- http-server: `npx http-server frontend-user -p 3000`
- Or any local web server

## OTP Service Configuration

### Option 1: Fast2SMS (Easiest for India)

1. **Sign Up**:
   - Go to [https://www.fast2sms.com](https://www.fast2sms.com)
   - Complete registration
   - Verify your mobile number

2. **Get API Key**:
   - Login to Fast2SMS dashboard
   - Go to "API" section
   - Copy your API key

3. **Add to Environment**:
   ```env
   FAST2SMS_API_KEY=your_api_key_here
   ```

4. **Test**:
   - Make a test call to send OTP endpoint
   - Check if SMS arrives on test number

**Pricing**: ₹0.15 per SMS (approximately)

### Option 2: Twilio (International)

1. **Sign Up**:
   - Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   - Complete registration
   - Verify your phone number

2. **Get Credentials**:
   - From Twilio Console, copy:
     - Account SID
     - Auth Token
   - Get a Twilio phone number (free for trial)

3. **Add to Environment**:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

4. **Trial Limitations**:
   - Can only send to verified numbers
   - Add test numbers in Twilio Console → Phone Numbers → Verified Caller IDs

**Pricing**: $0.0079 per SMS (US), varies by country

### Testing OTP Without Service (Development Only)

For development, the system will log OTP to console if no provider is configured:

```javascript
// Check backend console after requesting OTP
// You'll see: 📱 OTP for 9876543210: 123456 (Demo mode)
```

## Payment Gateway Setup

### Razorpay Integration

#### Step 1: Create Account

1. Go to [https://razorpay.com](https://razorpay.com)
2. Click "Sign Up"
3. Complete business verification (for production)

#### Step 2: Get Test API Keys

1. Login to Razorpay Dashboard
2. Go to Settings (left sidebar)
3. Click on "API Keys" under "Website and App Settings"
4. Generate Test Key (use Mode toggle)
5. Copy:
   - Key ID (starts with `rzp_test_`)
   - Key Secret (click "Show" to reveal)

#### Step 3: Configure Backend

Add to `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

#### Step 4: Add Razorpay Script to Frontend

In `frontend-user/cart.html`, add before `</body>`:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

#### Step 5: Configure Webhook (Important!)

1. In Razorpay Dashboard, go to Settings → Webhooks
2. Click "Add New Webhook"
3. Enter Webhook URL:
   - Local: Use ngrok (see below)
   - Production: `https://your-domain.com/api/webhooks/razorpay`

4. Select Events:
   - ✅ payment.authorized
   - ✅ payment.captured
   - ✅ payment.failed

5. Copy Webhook Secret
6. Add to `.env`:
   ```env
   RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

#### Testing with ngrok (Local Development)

```bash
# Install ngrok
npm install -g ngrok

# Start your backend first
cd backend
npm start

# In another terminal, expose port 5000
ngrok http 5000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this as your webhook URL: https://abc123.ngrok.io/api/webhooks/razorpay
```

#### Test Payment

1. Go to cart and add items
2. Click "Proceed to Checkout"
3. Select "Online Payment"
4. Use Razorpay test cards:
   - Card: 4111 1111 1111 1111
   - CVV: Any 3 digits
   - Expiry: Any future date
   - Name: Any name

5. Or use test UPI: success@razorpay

#### Production Setup

1. Complete KYC verification in Razorpay
2. Switch to Live mode
3. Generate Live API keys
4. Update `.env` with live keys
5. Update webhook URL to production domain

**Pricing**:
- 2% + ₹0 per transaction (India)
- No setup or annual fees

## Push Notifications Setup

### Firebase Cloud Messaging (FCM)

#### Step 1: Create Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add Project"
3. Enter project name: "FoodZone"
4. Disable Google Analytics (optional)

#### Step 2: Get Service Account Key

1. In Firebase Console, click ⚙️ → Project Settings
2. Go to "Service Accounts" tab
3. Click "Generate New Private Key"
4. Download JSON file

#### Step 3: Configure Backend

From the downloaded JSON file, extract:

```json
{
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
}
```

Add to `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Note**: Keep the quotes and `\n` in the private key

#### Step 4: Get FCM Server Key (Legacy - for older SDKs)

1. Go to Project Settings → Cloud Messaging
2. Copy "Server Key"
3. Add to `.env`:
   ```env
   FCM_SERVER_KEY=your_fcm_server_key
   ```

#### Testing Notifications

Notifications will work when:
1. User/Vendor has registered a device token
2. Order status changes
3. Payment is completed

For testing without mobile app:
- Check backend console logs
- Notifications are saved in `notifications` table

## Testing the Application

### 1. Test User Registration & Login

```bash
# Using curl or Postman

# 1. Request OTP
curl -X POST http://localhost:5000/api/auth/user/login-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'

# Response: {"success": true, "data": {"userId": 1, "phone": "9876543210"}}

# 2. Check console for OTP (if no SMS service configured)
# Look for: 📱 OTP for 9876543210: 123456

# 3. Verify OTP
curl -X POST http://localhost:5000/api/auth/user/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "otp": "123456"}'

# Response: JWT token + user data
```

### 2. Test Adding Products to Cart

```bash
# Get token from login response
TOKEN="your_jwt_token_here"

# Add to cart
curl -X POST http://localhost:5000/api/cart/add \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId": 1, "quantity": 2}'
```

### 3. Test Order Creation

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryAddress": "123 Main St, City",
    "paymentMode": "cod"
  }'
```

### 4. Test Payment Flow

1. Add items to cart via UI
2. Go to checkout
3. Enter delivery address
4. Select "Online Payment"
5. Use Razorpay test card
6. Verify payment success

## Production Deployment

### Pre-Deployment Checklist

```bash
# 1. Update production environment variables
NODE_ENV=production
DB_HOST=production_db_host
RAZORPAY_KEY_ID=rzp_live_xxxxx  # Live keys!
RAZORPAY_KEY_SECRET=live_secret

# 2. Change JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# 3. Update CORS origins
USER_APP_URL=https://your-domain.com
VENDOR_APP_URL=https://vendor.your-domain.com
ADMIN_APP_URL=https://admin.your-domain.com
```

### Security Hardening

1. **Change Default Passwords**:
   ```sql
   -- Update admin password
   UPDATE admin_users
   SET password = '$2b$10$new_hashed_password'
   WHERE email = 'admin@foodzone.com';
   ```

2. **Enable Rate Limiting**:
   Already configured in middleware, ensure these are set:
   ```env
   RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
   RATE_LIMIT_MAX_REQUESTS=100
   OTP_RATE_LIMIT_MAX=3
   ```

3. **Configure Firewall**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

4. **Set Up SSL**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

5. **Database Backup**:
   ```bash
   # Create backup script
   #!/bin/bash
   mysqldump -u user -p database > backup-$(date +%Y%m%d).sql

   # Add to crontab (daily at 2 AM)
   0 2 * * * /path/to/backup.sh
   ```

### Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs foodzone-api

# Check status
pm2 status
```

### Maintenance Mode

To enable maintenance:
```sql
UPDATE app_config
SET config_value = '1'
WHERE config_key = 'maintenance_mode';
```

## Common Issues

### Issue: "Database connection failed"
**Solution**:
```bash
# Check MySQL status
sudo systemctl status mysql

# Test connection
mysql -u your_user -p -h localhost
```

### Issue: "OTP not received"
**Solution**:
- Check OTP provider balance
- Verify API keys
- Check rate limiting (max 3 OTPs per 15 min)
- Check `otp_verification` table for entries

### Issue: "Payment webhook not working"
**Solution**:
- Verify webhook URL is publicly accessible
- Check webhook secret matches
- Test with Razorpay webhook testing tool
- Check `api_logs` table for webhook requests

### Issue: "CORS error in frontend"
**Solution**:
Update CORS origins in `server.js`:
```javascript
const corsOptions = {
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true
};
```

## Need Help?

1. Check `error_logs` table in database
2. Check `api_logs` for request/response data
3. Check PM2 logs: `pm2 logs foodzone-api`
4. Enable debug mode: `DEBUG=* npm start`

---

**Happy Coding! 🚀**
