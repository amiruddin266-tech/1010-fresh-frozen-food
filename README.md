# 1010 Fresh Frozen Food

A Node.js + Express + SQLite e-commerce site for five frozen chicken products, size variants, Billplz checkout, QR-to-Billplz payment, email and WhatsApp order notifications, SEO metadata, JSON-LD structured data, sitemap and robots.txt.

## Included
- Responsive storefront and cart
- 5 products × S/M/L/XL/XXL variants
- Server-side price calculation (never trusts browser prices)
- Customer name, phone, email and delivery address
- Billplz V3 bill creation and callback handling
- Billplz X Signature verification
- QR code generated for each Billplz payment URL
- SQLite order database with idempotent payment processing
- Email notifications through SMTP
- WhatsApp Cloud API template notifications
- Simple password-protected admin order dashboard
- Helmet security headers, compression, rate limiting, validation
- SEO-friendly metadata, canonical URL, Open Graph, sitemap and Product/Organization JSON-LD

## Important production setup
1. Install Node.js 20+.
2. Run `npm ci` (or `npm install` for the first install).
3. Copy `.env.example` to `.env` and set every production secret.
4. Create and activate a Billplz Collection. Billplz requires a Collection ID to create bills. The API accepts MYR in cents and uses HTTPS. See the official docs: https://support.billplz.com/api
5. Enable Billplz X Signature and put the X Signature key into `BILLPLZ_X_SIGNATURE_KEY`.
6. Set the Billplz callback URL to `/api/payments/billplz/callback` and redirect URL to `/payment-result`.
7. Configure your SMTP credentials.
8. Create/approve a WhatsApp Business Cloud API message template named in `WHATSAPP_TEMPLATE_NAME`. The default code expects body variables: order number, customer name, total and payment status. Adjust `src/notifications.js` if your template variables differ.
9. Deploy behind HTTPS. Set `SITE_URL` to the exact public HTTPS origin.
10. Change `ADMIN_PASSWORD` to a long random password.
11. Run `npm start` behind a process manager/reverse proxy (e.g. systemd, Docker, PM2). Keep the SQLite database on persistent storage.

## Pricing
Sample prices are in `src/products.js`. Replace them with your actual selling prices before launch. Prices are server-side and are not accepted from the browser.

## QR payment
The checkout QR is generated from the Billplz payment URL. Scanning it opens the Billplz bill, so payment is still recorded by Billplz and reaches this site's callback. This avoids manual bank-transfer verification. Which payment methods appear on the Billplz page depends on the payment gateways enabled in your Billplz account.

## Test
Run `npm test`. Use Billplz Sandbox credentials and sandbox API URL for payment testing. Do not use production keys in development.
