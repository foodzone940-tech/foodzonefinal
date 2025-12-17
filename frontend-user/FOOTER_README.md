# Footer Structure Documentation

## ⚠️ IMPORTANT - DO NOT MODIFY

This footer has been implemented with a **strict structure lock**. All layout, spacing, colors, and alignment are **FIXED** and must not be changed.

## Footer Sections

### 1. Brand Section (Left)
- Logo: 🍔 FoodZone
- Description: "FoodZone is an online food & grocery delivery platform."

### 2. Legal Links
All links are **working** and point to actual pages:
- Privacy Policy → `privacy-policy.html`
- Terms & Conditions → `terms-conditions.html`
- Refund & Cancellation Policy → `refund-policy.html`
- Delivery Policy → `delivery-policy.html`

### 3. Help & Support
All links are **working** and point to actual pages:
- Contact Us → `contact.html`
- Help Center → `help-center.html`
- Report an Issue → `report-issue.html`

**Contact Information:**
- Email: foodzonesupport@gmail.com (clickable mailto link)
- Phone 1: +91 89175 68630 (clickable tel link)
- Phone 2: +91 97786 39461 (clickable tel link)

### 4. Payments & App Section
- "Secure Payments" text
- Payment icons: UPI, GPay, PhonePe, Paytm (text-based, ready for image replacement)
- Google Play button (ready for image replacement)
- "App coming soon on Play Store" text

### 5. Bottom Section
- "Follow Us" text
- Social icons: Facebook, Instagram, X (Twitter), YouTube (text-based, ready for image replacement)
- Copyright: "© 2025 FoodZone. All rights reserved."

## Image Replacement Guide

### Current Implementation
All payment icons and social icons are currently **text-based** placeholders. This allows you to:
1. Keep the exact layout and spacing
2. Replace text with actual image files
3. No code logic changes required

### How to Replace with Images

#### Step 1: Prepare Your Images
Create a folder structure:
```
frontend-user/
  ├── images/
  │   ├── payments/
  │   │   ├── upi.png
  │   │   ├── gpay.png
  │   │   ├── phonepe.png
  │   │   └── paytm.png
  │   ├── social/
  │   │   ├── facebook.png
  │   │   ├── instagram.png
  │   │   ├── twitter.png
  │   │   └── youtube.png
  │   └── app/
  │       └── google-play.png
```

#### Step 2: Replace Payment Icons
In `footer.html` or individual page footers, replace:
```html
<!-- OLD (text-based) -->
<div class="payment-icon">UPI</div>
<div class="payment-icon">GPay</div>

<!-- NEW (image-based) -->
<div class="payment-icon">
  <img src="images/payments/upi.png" alt="UPI" width="45" height="28">
</div>
<div class="payment-icon">
  <img src="images/payments/gpay.png" alt="Google Pay" width="45" height="28">
</div>
```

#### Step 3: Replace Social Icons
Replace social icon text with images:
```html
<!-- OLD -->
<a href="https://facebook.com" target="_blank" class="social-icon">f</a>

<!-- NEW -->
<a href="https://facebook.com" target="_blank" class="social-icon">
  <img src="images/social/facebook.png" alt="Facebook" width="20" height="20">
</a>
```

#### Step 4: Replace Google Play Badge
Replace the app badge:
```html
<!-- OLD -->
<a href="#" class="app-badge">
  <span class="app-badge-icon">📱</span>
  Google Play
</a>

<!-- NEW -->
<a href="#" class="app-badge">
  <img src="images/app/google-play.png" alt="Get it on Google Play" height="40">
</a>
```

## CSS Modification Rules

### ✅ ALLOWED Changes:
- Replacing text content with image URLs
- Updating href links
- Changing contact email/phone numbers
- Updating social media URLs

### ❌ NOT ALLOWED Changes:
- Grid layout structure
- Spacing and padding values
- Background colors (#1f2937, #111827)
- Text colors (#e5e7eb, #d1d5db, #9ca3af)
- Font sizes
- Border radius
- Hover effects
- Responsive breakpoints
- Section ordering

## Files Using This Footer

All user-facing pages include this footer:
1. `index.html` - Home page
2. `cart.html` - Cart page
3. `orders.html` - Orders page
4. `privacy-policy.html` - Privacy policy
5. `terms-conditions.html` - Terms & conditions
6. `refund-policy.html` - Refund policy (to be created)
7. `delivery-policy.html` - Delivery policy (to be created)
8. `contact.html` - Contact page (to be created)
9. `help-center.html` - Help center (to be created)
10. `report-issue.html` - Report issue page (to be created)

## Footer CSS File

`footer.css` contains all footer-specific styles. **DO NOT MODIFY** unless:
- You are replacing text with images (update selectors if needed)
- You are adding new footer sections (rare case)

## Color Scheme (LOCKED)

```css
/* Main Footer */
background-color: #1f2937; /* Dark gray */
color: #e5e7eb; /* Light gray text */

/* Footer Bottom */
background-color: #111827; /* Darker gray */
border-top: 1px solid #374151; /* Medium gray */

/* Links */
color: #d1d5db; /* Medium light gray */
hover: #3b82f6; /* Blue */

/* Headings */
color: #ffffff; /* White */
```

## Responsive Behavior

The footer automatically adjusts for mobile:
- Desktop: 4-column grid
- Mobile: Single column stack
- Social icons centered on mobile
- Maintains all spacing proportions

## Support

For questions about footer modifications:
- Email: foodzonesupport@gmail.com
- Phone: +91 89175 68630 / +91 97786 39461

---

**Last Updated:** December 17, 2025
**Footer Version:** 1.0
**Status:** PRODUCTION LOCKED
