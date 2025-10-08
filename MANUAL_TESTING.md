# Manual Testing Guide - MX Lambda API

## Prerequisites
1. AWS CLI configured: `aws configure`
2. Serverless Framework installed: `npm install -g serverless`
3. All environment variables set in `.env` file

## Step 1: Deploy to AWS

```bash
# Deploy to development environment
npm run deploy:dev

# Or use serverless directly
serverless deploy --stage dev
```

After deployment, you'll get an API Gateway URL like:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

## Step 2: Test with curl

### 1. Create Payment Link

```bash
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
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
    "sendSMS": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "uuid-here",
    "mxPaymentLinkId": "pl_12345abc",
    "checkoutUrl": "https://sandbox.mxmerchant.com/checkout/pl_12345abc",
    "status": "created",
    "amount": 487.50,
    "smsNotification": {
      "sent": true,
      "messageSid": "SM1234567890"
    }
  }
}
```

### 2. Get Payment Status

```bash
# Replace PAYMENT_LINK_ID with the ID from the previous response
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/payment-links/PAYMENT_LINK_ID
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "uuid-here",
    "status": "created",
    "amount": 487.50,
    "currency": "USD",
    "invoice": {...},
    "customer": {...}
  }
}
```

### 3. Test Webhook (Simulated MX Merchant callback)

```bash
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "paymentLinkId": "pl_12345abc",
    "eventType": "payment.completed",
    "status": "completed",
    "amount": 487.50,
    "currency": "USD",
    "transactionId": "txn_12345",
    "timestamp": "2024-01-15T10:45:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## Step 3: Test with Postman

### Import Collection

Create a new Postman collection with these three requests:

#### 1. Create Payment Link
- **Method**: POST
- **URL**: `{{base_url}}/payment-links`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "amount": 487.50,
  "currency": "USD",
  "invoice": {
    "number": "RO-252656",
    "description": "Brake Service Complete"
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
  "sendSMS": true
}
```

#### 2. Get Payment Status
- **Method**: GET
- **URL**: `{{base_url}}/payment-links/{{payment_link_id}}`

#### 3. Webhook Handler
- **Method**: POST
- **URL**: `{{base_url}}/webhook`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "paymentLinkId": "pl_12345abc",
  "eventType": "payment.completed",
  "status": "completed",
  "amount": 487.50,
  "transactionId": "txn_12345",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

### Postman Environment Variables
Create an environment with:
- `base_url`: `https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev`
- `payment_link_id`: (save from response of Create Payment Link)

## Testing Flow

1. **Create Payment Link** → Get `paymentLinkId` and `checkoutUrl`
2. **Check Status** → Verify it's "created"
3. **Simulate Webhook** → Send payment completed event
4. **Check Status Again** → Verify it's now "completed"

## Error Testing

### Test Invalid Amount
```bash
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "invalid",
    "invoice": {"number": "TEST-123"},
    "customer": {"name": "Test", "email": "test@test.com"}
  }'
```

### Test Missing Fields
```bash
curl -X POST https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100
  }'
```

### Test Non-existent Payment Link
```bash
curl https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/payment-links/non-existent-id
```

## Monitoring

Check CloudWatch logs for detailed execution info:
```bash
serverless logs -f createPaymentLink --stage dev --tail
serverless logs -f getPaymentStatus --stage dev --tail
serverless logs -f handleWebhook --stage dev --tail
```

## Cleanup

Remove the deployment:
```bash
serverless remove --stage dev
```

## Notes

- The MX Merchant sandbox will return test responses
- SMS won't actually send in test mode (check Twilio logs)
- DynamoDB table will be created automatically during deployment
- Each deployment creates a new API Gateway URL
