# Yemeni Payment Providers Integration Guide

## Overview

This document describes the integration of Yemeni electronic wallet providers into the Nouf-ex e-commerce platform. The platform supports the following Yemeni payment methods:

| Provider | Arabic Name | Status | Contact |
|----------|-------------|--------|---------|
| **Jib** | جيب | Pending API Access | https://jib.ye |
| **Al-Karimi** | الكريمي | Pending API Access | https://alkarimi.com |
| **Jawali** | جوالي | Pending API Access | https://jawali.ye |
| **Floosk** | فلوسك | Pending API Access | https://floosk.com |
| **Yemen Wallet** | يمن والت | Pending API Access | https://yemenwallet.ye |

## Architecture

All Yemeni providers follow a common architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Server    │────▶│  Yemeni Provider│
│   (React SPA)   │     │   (Express)     │     │  (External API) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   PostgreSQL    │     │   Webhook       │
                        │   Database      │◀────│   Callback      │
                        └─────────────────┘     └─────────────────┘
```

### Payment Flow

1. **Initiation**: Customer selects a Yemeni wallet provider at checkout
2. **Redirect**: Customer is redirected to the provider's payment page
3. **Payment**: Customer completes payment on the provider's platform
4. **Callback**: Provider sends webhook notification to our callback URL
5. **Verification**: We verify the webhook signature and update order status
6. **Confirmation**: Customer is redirected back to the order confirmation page

## Environment Variables

Each provider requires the following environment variables:

### Jib (جيب)
```bash
JIB_MERCHANT_ID=your_merchant_id
JIB_API_KEY=your_api_key
JIB_WEBHOOK_SECRET=your_webhook_secret
JIB_API_URL=https://api.jib.ye/v1
JIB_CALLBACK_URL=https://your-domain.com/api/payments/webhook/jib
JIB_RETURN_URL=https://your-domain.com
```

### Al-Karimi (الكريمي)
```bash
ALKARIMI_MERCHANT_ID=your_merchant_id
ALKARIMI_API_KEY=your_api_key
ALKARIMI_WEBHOOK_SECRET=your_webhook_secret
ALKARIMI_API_URL=https://api.alkarimi.com/v1
ALKARIMI_CALLBACK_URL=https://your-domain.com/api/payments/webhook/alkarimi
ALKARIMI_RETURN_URL=https://your-domain.com
```

### Jawali (جوالي)
```bash
JAWALI_MERCHANT_ID=your_merchant_id
JAWALI_API_KEY=your_api_key
JAWALI_WEBHOOK_SECRET=your_webhook_secret
JAWALI_API_URL=https://api.jawali.ye/v1
JAWALI_CALLBACK_URL=https://your-domain.com/api/payments/webhook/jawali
JAWALI_RETURN_URL=https://your-domain.com
```

### Floosk (فلوسك)
```bash
FLOOSK_MERCHANT_ID=your_merchant_id
FLOOSK_API_KEY=your_api_key
FLOOSK_WEBHOOK_SECRET=your_webhook_secret
FLOOSK_API_URL=https://api.floosk.com/v1
FLOOSK_CALLBACK_URL=https://your-domain.com/api/payments/webhook/floosk
FLOOSK_RETURN_URL=https://your-domain.com
```

### Yemen Wallet (يمن والت)
```bash
YEMEN_WALLET_MERCHANT_ID=your_merchant_id
YEMEN_WALLET_API_KEY=your_api_key
YEMEN_WALLET_WEBHOOK_SECRET=your_webhook_secret
YEMEN_WALLET_API_URL=https://api.yemenwallet.ye/v1
YEMEN_WALLET_CALLBACK_URL=https://your-domain.com/api/payments/webhook/yemen_wallet
YEMEN_WALLET_RETURN_URL=https://your-domain.com
```

## API Endpoints

### Initiate Payment
```http
POST /api/payments
Content-Type: application/json
Authorization: Bearer <token>

{
  "order_id": 123,
  "amount": 5000,
  "currency": "YER",
  "method": "jib"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_id": 123,
    "method": "jib",
    "status": "pending",
    "amount": 5000,
    "currency": "YER",
    "redirect_url": "https://api.jib.ye/v1/pay/order_123_1234567890"
  }
}
```

### Webhook Callback
```http
POST /api/payments/webhook/jib
Content-Type: application/json

{
  "transaction_id": "jib_txn_123",
  "reference_id": "order_123_1234567890",
  "amount": 5000,
  "currency": "YER",
  "status": "completed",
  "timestamp": "2026-07-15T10:00:00Z",
  "signature": "hmac_sha256_signature"
}
```

### List Available Methods
```http
GET /api/payments/methods
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "method": "jib", "displayName": "Jib (جيب)", "live": false },
    { "method": "alkarimi", "displayName": "Al-Karimi (الكريمي)", "live": false },
    { "method": "jawali", "displayName": "Jawali (جوالي)", "live": false },
    { "method": "floosk", "displayName": "Floosk (فلوسك)", "live": false },
    { "method": "yemen_wallet", "displayName": "Yemen Wallet (يمن والت)", "live": false }
  ]
}
```

## Security

### Signature Verification

All webhook callbacks are verified using HMAC-SHA256 signatures. The signature is computed over the sorted key-value pairs of the webhook payload (excluding the signature field itself).

```typescript
const signString = Object.entries(data)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k}=${v}`)
  .join('&');

const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(signString)
  .digest('hex');
```

### Constant-Time Comparison

Signatures are compared using `crypto.timingSafeEqual()` to prevent timing attacks.

### Environment Variables

All sensitive configuration (API keys, merchant IDs, webhook secrets) must be stored in environment variables, never in code.

## Database Schema

The payment methods are validated at the database level:

```sql
-- orders table
CHECK (payment_method IN (
    'cod','card','wallet','bank_transfer','stripe','paymob',
    'alipay','wechat_pay',
    'jib','alkarimi','jawali','floosk','yemen_wallet'
))

-- payments table
CHECK (method IN (
    'cod','card','wallet','bank_transfer','stripe','paymob',
    'alipay','wechat_pay',
    'jib','alkarimi','jawali','floosk','yemen_wallet'
))
```

## Integration Checklist

### Before Going Live

- [ ] Obtain merchant account from each provider
- [ ] Receive API credentials (merchant ID, API key, webhook secret)
- [ ] Configure environment variables in production
- [ ] Test webhook callbacks in staging environment
- [ ] Verify signature verification works correctly
- [ ] Test payment flow end-to-end
- [ ] Configure monitoring and alerting for failed payments
- [ ] Document support contacts for each provider

### Provider-Specific Notes

#### Jib (جيب)
- Primary wallet in Yemen
- Supports QR code payments
- API documentation: https://docs.jib.ye

#### Al-Karimi (الكريمي)
- Popular in southern Yemen
- Supports USSD payments
- API documentation: https://docs.alkarimi.com

#### Jawali (جوالي)
- Mobile-first wallet
- Supports NFC payments
- API documentation: https://docs.jawali.ye

#### Floosk (فلوسك)
- Newer provider
- Lower transaction fees
- API documentation: https://docs.floosk.com

#### Yemen Wallet (يمن والت)
- Government-backed wallet
- Supports bill payments
- API documentation: https://docs.yemenwallet.ye

## Support

For integration support:
- **Technical**: dev@noufex.com
- **Business**: partnerships@noufex.com
- **Documentation**: https://docs.noufex.com/payments/yemeni
