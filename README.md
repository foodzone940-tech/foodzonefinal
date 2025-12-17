# FoodZone - Production-Ready Food Delivery System

A complete, production-ready food delivery platform (Swiggy-like MVP) with real authentication, payment processing, and order management.

## 🎯 Key Features

### REAL Authentication
- Mobile OTP login via Fast2SMS/Twilio
- JWT + Refresh Token implementation
- Role-based access (User/Vendor/Admin)
- Secure password hashing with bcrypt

### REAL Payment Integration
- Razorpay payment gateway (UPI + Cards)
- Server-side payment verification
- Webhook handling for payment events
- Refund processing

### Complete Order Management
- Cart → Order conversion with DB transactions
- Real-time order status tracking
- Inventory management
- Order cancellation with stock restoration

### Vendor Management
- Vendor dashboard with analytics
- Product CRUD operations
- Order processing workflow
- Earnings and payout tracking

### Admin Panel
- System-wide analytics
- User and vendor management
- Payment transaction monitoring
- Activity and error logs

### Push Notifications
- Firebase Cloud Messaging (FCM)
- Order status updates
- Payment confirmation alerts

## 📁 Project Structure

```
project/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/            # Database, environment config
│   │   ├── middleware/        # Auth, error handling, rate limiting
│   │   ├── controllers/       # Business logic
│   │   ├── services/          # OTP, payment, notifications
│   │   └── routes/            # API routes
│   ├── server.js              # Entry point
│   └── package.json
│
├── frontend-user/             # Customer-facing app
│   ├── index.html
│   ├── cart.html
│   ├── orders.html
│   ├── app.js
│   └── styles.css
│
├── frontend-vendor/           # Vendor management panel
│   ├── index.html
│   ├── app.js
│   └── config.js
│
├── frontend-admin/            # Admin dashboard
│   └── index.html
│
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MySQL 5.7+ / MariaDB
- npm or yarn

### 1. Database Setup

Import the provided SQL schema into your MySQL database:

```bash
mysql -u your_username -p your_database_name < u816290961_foodzone_db.sql
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Configure Environment Variables

Edit `backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=u816290961_foodzone_db

# JWT Secrets (Generate strong random strings)
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here

# OTP Provider (Choose ONE)
FAST2SMS_API_KEY=your_fast2sms_key        # Option 1
# OR
TWILIO_ACCOUNT_SID=your_twilio_sid        # Option 2
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Firebase (Optional - for push notifications)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

### 4. Start Backend Server

```bash
cd backend
npm start
```

Server will start on `http://localhost:5000`

### 5. Launch Frontend Applications

```bash
# User App - Open in browser
cd frontend-user
# Serve with any static server (Live Server, http-server, etc.)
# Or simply open index.html in browser

# Vendor Panel
cd frontend-vendor
# Open index.html in browser

# Admin Panel
cd frontend-admin
# Open index.html in browser
```

## 🔐 Setting Up Services

### A. OTP Service Setup

#### Option 1: Fast2SMS (Recommended for India)

1. Sign up at [https://www.fast2sms.com](https://www.fast2sms.com)
2. Get API key from dashboard
3. Add to `.env`: `FAST2SMS_API_KEY=your_key`

#### Option 2: Twilio (International)

1. Sign up at [https://www.twilio.com](https://www.twilio.com)
2. Get Account SID, Auth Token, and Phone Number
3. Add credentials to `.env`

### B. Razorpay Payment Setup

1. Sign up at [https://razorpay.com](https://razorpay.com)
2. Go to Settings → API Keys
3. Generate Key ID and Secret
4. Add to `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxx
   RAZORPAY_KEY_SECRET=your_secret_key
   ```

5. **Configure Webhook**:
   - Go to Settings → Webhooks
   - Add webhook URL: `https://your-domain.com/api/webhooks/razorpay`
   - Select events: `payment.captured`, `payment.failed`
   - Copy webhook secret to `.env`: `RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx`

6. **Add Razorpay Script to Frontend**:
   Add before closing `</body>` tag in `cart.html`:
   ```html
   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
   ```

### C. Firebase Cloud Messaging (Optional)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project or use existing
3. Go to Project Settings → Service Accounts
4. Generate new private key
5. Add credentials to `.env`:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

## 👥 Default Access

### Create First Admin User

Run this SQL query in your database:

```sql
INSERT INTO admin_users (name, email, password, role, is_active)
VALUES (
  'Super Admin',
  'admin@foodzone.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- password: password123
  'super_admin',
  1
);
```

**Login**: admin@foodzone.com
**Password**: password123
**⚠️ Change this password immediately in production!**

### Create Test Vendor

```sql
INSERT INTO vendors (vendor_name, phone, email, password, status)
VALUES (
  'Test Restaurant',
  '9876543210',
  'vendor@test.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- password: password123
  1
);
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/user/login-otp` - Send OTP to user
- `POST /api/auth/user/verify-otp` - Verify OTP & login
- `POST /api/auth/vendor/login-otp` - Vendor OTP login
- `POST /api/auth/admin/login` - Admin email/password login

### Products
- `GET /api/products` - List products
- `GET /api/products/:id` - Product details
- `GET /api/categories` - Categories list
- `GET /api/vendors` - Vendors list

### Cart (Protected)
- `GET /api/cart` - Get user cart
- `POST /api/cart/add` - Add to cart
- `PUT /api/cart/:id` - Update quantity
- `DELETE /api/cart/:id` - Remove item

### Orders (Protected)
- `POST /api/orders` - Create order
- `GET /api/orders` - User orders
- `POST /api/orders/:id/verify-payment` - Verify Razorpay payment
- `POST /api/orders/:id/cancel` - Cancel order

### Vendor APIs (Protected)
- `GET /api/vendor/dashboard` - Dashboard stats
- `GET /api/vendor/orders` - Vendor orders
- `PUT /api/vendor/orders/:id/status` - Update order status
- `GET /api/vendor/products` - Vendor products
- `POST /api/vendor/products` - Add product
- `PUT /api/vendor/products/:id` - Update product

### Admin APIs (Protected)
- `GET /api/admin/dashboard` - System stats
- `GET /api/admin/users` - All users
- `GET /api/admin/vendors` - All vendors
- `GET /api/admin/orders` - All orders
- `GET /api/admin/payments` - Payment transactions
- `POST /api/admin/payouts` - Process vendor payout

## 🚢 Deployment

### VPS Deployment (Hostinger/DigitalOcean/AWS EC2)

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 (Process Manager)
sudo npm install -g pm2
```

#### 2. MySQL Configuration

```bash
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE u816290961_foodzone_db;
CREATE USER 'foodzone_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON u816290961_foodzone_db.* TO 'foodzone_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import schema:
```bash
mysql -u foodzone_user -p u816290961_foodzone_db < u816290961_foodzone_db.sql
```

#### 3. Deploy Backend

```bash
# Clone/upload your project
cd /var/www
sudo mkdir foodzone
sudo chown $USER:$USER foodzone
cd foodzone

# Upload files via FTP/Git
# Or use: scp -r ./backend user@your-server:/var/www/foodzone/

cd backend
npm install --production

# Create .env with production values
nano .env

# Start with PM2
pm2 start server.js --name foodzone-api
pm2 save
pm2 startup
```

#### 4. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/foodzone
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com api.your-domain.com;

    # API Backend
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # User Frontend
    location / {
        root /var/www/foodzone/frontend-user;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Vendor Panel
    location /vendor {
        alias /var/www/foodzone/frontend-vendor;
        index index.html;
        try_files $uri $uri/ /vendor/index.html;
    }

    # Admin Panel
    location /admin {
        alias /var/www/foodzone/frontend-admin;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }

    # Uploads
    location /uploads {
        alias /var/www/foodzone/backend/uploads;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/foodzone /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

#### 6. Firewall Setup

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Production Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure real OTP provider
- [ ] Set up Razorpay production keys
- [ ] Configure Firebase FCM
- [ ] Set up database backups
- [ ] Enable error logging
- [ ] Configure rate limiting
- [ ] Set `NODE_ENV=production`
- [ ] Restrict CORS origins
- [ ] Set up monitoring (PM2, UptimeRobot)

## 🔧 Troubleshooting

### Backend won't start
- Check database connection
- Verify all environment variables
- Check port 5000 availability: `lsof -i :5000`

### OTP not sending
- Verify API keys in `.env`
- Check OTP service balance/credits
- Check API logs in database

### Payment not working
- Verify Razorpay keys (test/live)
- Check Razorpay dashboard for errors
- Ensure webhook URL is accessible
- Verify HTTPS for production

### Database connection failed
- Check MySQL service: `sudo systemctl status mysql`
- Verify credentials
- Check firewall rules

## 📝 License

MIT License - Use freely for commercial projects

## 🤝 Support

For issues or questions:
1. Check existing database schema matches your setup
2. Verify all environment variables
3. Check server logs: `pm2 logs foodzone-api`
4. Check database error_logs table

---

**Built with Node.js, Express, MySQL, and Vanilla JavaScript**
