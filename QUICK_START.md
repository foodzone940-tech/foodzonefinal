# Quick Start Guide - Get Running in 10 Minutes

## Prerequisites
- Node.js 16+ installed
- MySQL running
- 10 minutes of your time

## Step 1: Database (2 minutes)

```bash
# Import database
mysql -u root -p < u816290961_foodzone_db.sql

# Or if database already exists
mysql -u root -p your_database_name < u816290961_foodzone_db.sql
```

## Step 2: Backend Setup (3 minutes)

```bash
cd backend
npm install

# Create .env file
cat > .env << EOL
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=u816290961_foodzone_db

JWT_SECRET=my_super_secret_jwt_key_for_development
JWT_REFRESH_SECRET=my_super_secret_refresh_key_for_development

# Leave OTP providers empty for development (OTP will print in console)
# Leave payment empty for testing (or add Razorpay test keys)
EOL

# Start server
npm start
```

**Expected Output**:
```
✅ Database connected successfully
📡 Server running on port: 5000
```

## Step 3: Open Frontend (1 minute)

### Option A: Using VS Code Live Server
1. Open VS Code
2. Install "Live Server" extension
3. Right-click `frontend-user/index.html`
4. Click "Open with Live Server"

### Option B: Using npx
```bash
cd frontend-user
npx http-server -p 3000
```

### Option C: Just open in browser
Double-click `frontend-user/index.html`

## Step 4: Create Test Data (2 minutes)

Open MySQL and run:

```sql
-- Create admin user
INSERT INTO admin_users (name, email, password, role, is_active)
VALUES ('Admin', 'admin@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin', 1);

-- Create test vendor
INSERT INTO vendors (vendor_name, phone, email, password, status)
VALUES ('Test Restaurant', '9876543210', 'vendor@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1);

-- Get vendor ID
SET @vendor_id = LAST_INSERT_ID();

-- Create category
INSERT INTO categories (name) VALUES ('Fast Food');
SET @category_id = LAST_INSERT_ID();

-- Create test products
INSERT INTO products (vendor_id, category_id, name, description, price, status)
VALUES
(@vendor_id, @category_id, 'Burger', 'Delicious beef burger', 150.00, 1),
(@vendor_id, @category_id, 'Pizza', 'Cheese pizza', 250.00, 1),
(@vendor_id, @category_id, 'Fries', 'Crispy fries', 80.00, 1);

-- Add stock
INSERT INTO inventory_stock (product_id, quantity)
SELECT id, 100 FROM products WHERE vendor_id = @vendor_id;
```

## Step 5: Test the System (2 minutes)

### Test User Login
1. Open user frontend (http://localhost:3000)
2. Click "Login"
3. Enter phone: `9999999999`
4. Click "Send OTP"
5. Check backend console for OTP: `📱 OTP for 9999999999: 123456`
6. Enter the OTP and verify

### Test Ordering
1. Browse products
2. Add items to cart
3. Go to cart
4. Enter delivery address
5. Select "Cash on Delivery"
6. Place order

### Test Vendor Panel
1. Open `frontend-vendor/index.html`
2. Login with phone: `9876543210`
3. Get OTP from console
4. View orders and update status

### Test Admin Panel
1. Open `frontend-admin/index.html`
2. Login:
   - Email: `admin@test.com`
   - Password: `password123`
3. View dashboard stats

## Default Credentials

**Admin Panel**:
- Email: `admin@test.com`
- Password: `password123`

**Vendor Panel**:
- Phone: `9876543210`
- OTP: Check backend console

**User App**:
- Any 10-digit phone number
- OTP: Check backend console

## What Works Without External Services

✅ User registration/login (OTP prints to console)
✅ Product browsing
✅ Cart management
✅ Order creation with COD
✅ Vendor order management
✅ Admin panel

## What Needs External Services

❌ Real SMS OTP - Needs Fast2SMS/Twilio
❌ Online Payment - Needs Razorpay
❌ Push Notifications - Needs Firebase

## Next Steps

1. **Add Real OTP**: Follow [SETUP_GUIDE.md](SETUP_GUIDE.md#otp-service-configuration)
2. **Add Payments**: Follow [SETUP_GUIDE.md](SETUP_GUIDE.md#payment-gateway-setup)
3. **Deploy to VPS**: Follow [README.md](README.md#deployment)

## Troubleshooting

### "Database connection failed"
```bash
# Check MySQL is running
sudo systemctl status mysql

# Update DB credentials in .env
```

### "Cannot GET /"
```bash
# Make sure you're accessing the correct URL
# User app: http://localhost:3000
# Vendor: file:///path/to/frontend-vendor/index.html
# Admin: file:///path/to/frontend-admin/index.html
```

### "OTP not visible"
```bash
# Check backend console/terminal
# Look for: 📱 OTP for <phone>: <code>
```

### "Products not showing"
```sql
-- Run test data SQL from Step 4
-- Or check if products exist:
SELECT * FROM products;
```

## File Structure

```
project/
├── backend/              # API Server (port 5000)
│   ├── server.js        # Start here
│   ├── .env             # Configuration
│   └── src/             # Source code
│
├── frontend-user/       # Customer app
│   └── index.html       # Open this
│
├── frontend-vendor/     # Vendor panel
│   └── index.html       # Open this
│
└── frontend-admin/      # Admin dashboard
    └── index.html       # Open this
```

## API Testing

```bash
# Test health
curl http://localhost:5000/health

# Expected: {"success":true,"message":"Server is running"...}

# Get products
curl http://localhost:5000/api/products

# Expected: {"success":true,"data":[...]}
```

## That's It!

You now have a fully functional food delivery system running locally.

For production deployment and advanced features, check:
- [README.md](README.md) - Complete documentation
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Detailed setup instructions

**Need help?** Check the database `error_logs` table or backend console output.

---

**Built by Claude - Production Ready Food Delivery System** 🚀
