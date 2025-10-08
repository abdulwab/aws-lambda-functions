# MX Lambda API

A serverless API for integrating MX Merchant checkout with Celebration Chevrolet's 3CX Caller Pop system. This API handles payment link creation, webhook processing, and status tracking with SMS notifications via Twilio.

## Features

- 🏦 **MX Merchant Integration**: Create secure payment links for customer invoices
- 📱 **SMS Notifications**: Send payment links and status updates via Twilio
- 🔄 **Webhook Processing**: Handle payment status updates from MX Merchant
- 📊 **Status Tracking**: Real-time payment status monitoring
- 🗄️ **DynamoDB Storage**: Persistent storage for payment link records
- 🚀 **Serverless Architecture**: AWS Lambda + API Gateway

## Architecture

```
3CX Caller Pop → API Gateway → Lambda Functions → MX Merchant API
                     ↓
                DynamoDB ← Twilio SMS
```

## API Endpoints

### 1. Create Payment Link
**POST** `/payment-links`

Creates a new payment link for customer invoices.

**Request Body:**
```json
{
  "amount": 487.50,
  "currency": "USD",
  "invoice": {
    "number": "RO-252656",
    "description": "Brake Service Complete - 2019 Silverado 1500"
  },
  "customer": {
    "name": "Sarah Johnson",
    "email": "sarah.johnson@email.com",
    "phone": "+15551234567"
  },
  "lineItems": [
    {
      "description": "Brake Pad Replacement",
      "quantity": 1,
      "unitPrice": 150.00,
      "totalPrice": 150.00
    }
  ],
  "sendSMS": true,
  "redirectUrl": "https://celebrationchevrolet.com/payment/success",
  "cancelUrl": "https://celebrationchevrolet.com/payment/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "uuid-here",
    "mxPaymentLinkId": "pl_12345abc",
    "checkoutUrl": "https://sandbox.mxmerchant.com/checkout/pl_12345abc",
    "status": "created",
    "amount": 487.50,
    "currency": "USD",
    "invoice": { ... },
    "customer": { ... },
    "createdAt": "2024-01-15T10:30:00Z",
    "smsNotification": {
      "sent": true,
      "messageSid": "SM1234567890",
      "status": "sent"
    }
  }
}
```

### 2. Get Payment Status
**GET** `/payment-links/{id}`

Retrieves the current status of a payment link.

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "uuid-here",
    "status": "completed",
    "amount": 487.50,
    "currency": "USD",
    "invoice": { ... },
    "customer": { ... },
    "transactionId": "txn_12345",
    "completedAt": "2024-01-15T10:45:00Z",
    "lastSyncAt": "2024-01-15T10:45:00Z"
  }
}
```

### 3. Webhook Handler
**POST** `/webhook`

Processes webhook notifications from MX Merchant.

**Webhook Payload:**
```json
{
  "paymentLinkId": "pl_12345abc",
  "eventType": "payment.completed",
  "status": "completed",
  "amount": 487.50,
  "currency": "USD",
  "transactionId": "txn_12345",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

## Environment Configuration

Copy `env.example` to `.env` and configure:

```bash
# MX Merchant API Configuration
MX_MERCHANT_API_URL=https://sandbox.api.mxmerchant.com/checkout/v3
MX_MERCHANT_CONSUMER_KEY=your_consumer_key
MX_MERCHANT_CONSUMER_SECRET=your_consumer_secret
MX_MERCHANT_MERCHANT_ID=your_merchant_id

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# AWS Configuration
AWS_REGION=us-east-1
STAGE=dev
```

## Deployment

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Serverless Framework

### Install Dependencies
```bash
yarn install
```

### Deploy to AWS
```bash
# Deploy to development
yarn run deploy:dev

# Deploy to production
yarn run deploy:prod

# Or use the deployment script
./scripts/deploy.sh dev
./scripts/deploy.sh prod
```

### Testing
```bash
# Run unit tests
yarn test

# Test deployed API
./scripts/test-deployed-api.sh dev
```

## Database Schema

### Payment Links Table
- **Primary Key**: `paymentLinkId` (String)
- **GSI**: `createdAt` (String)
- **TTL**: 30 days

**Attributes:**
- `paymentLinkId`: UUID for internal tracking
- `mxPaymentLinkId`: MX Merchant payment link ID
- `checkoutUrl`: MX Merchant checkout URL
- `status`: Payment status (created, pending, completed, failed, cancelled)
- `amount`: Payment amount
- `currency`: Currency code (USD, CAD)
- `invoice`: Invoice information
- `customer`: Customer information
- `lineItems`: Invoice line items
- `transactionId`: MX Merchant transaction ID
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- `ttl`: Time-to-live for automatic cleanup

## SMS Notifications

The system sends SMS notifications for:

1. **Payment Link Created**: When a new payment link is generated
2. **Payment Completed**: When payment is successfully processed
3. **Payment Failed**: When payment processing fails

SMS templates:
- **Payment Link**: "Hi {name}, your payment link for invoice {number} (${amount}) is ready. Click here to pay: {link}"
- **Payment Confirmed**: "Payment confirmed! Invoice {number} for ${amount} has been processed successfully. Transaction ID: {id}"
- **Payment Failed**: "Payment failed for invoice {number} (${amount}). Reason: {reason}. Please try again or contact us for assistance."

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "details": "Additional error details"
  }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Security

- All API calls require proper authentication
- Webhook signatures are validated (when available)
- Customer data is encrypted in transit and at rest
- PCI compliance handled by MX Merchant hosted checkout

## Monitoring and Logging

- CloudWatch Logs for all Lambda functions
- Structured JSON logging with request IDs
- Error tracking and alerting
- Performance metrics and monitoring

## Support

For technical support or questions:
- Check CloudWatch logs for detailed error information
- Verify environment variables are properly configured
- Ensure MX Merchant and Twilio credentials are valid
- Contact the development team for assistance

## License

MIT License - See LICENSE file for details.
