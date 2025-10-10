# 🔔 MX Merchant Webhook Integration Guide

Complete guide for setting up and monitoring webhook events for payment status updates.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Webhook Registration](#webhook-registration)
4. [Event Types & Monitoring](#event-types--monitoring)
5. [Testing Webhooks](#testing-webhooks)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### What Are Webhooks?

Webhooks are automated notifications sent by MX Merchant when specific events occur (like payment completed, failed, etc.). Instead of constantly polling for status updates, MX Merchant will push notifications to your API in real-time.

### Event Flow

```
1. Customer receives invoice → Invoice status: "Unpaid" → Webhook fires
2. Customer pays → Invoice status: "Paid" → Webhook fires
3. Your Lambda updates database → SMS sent to customer
```

### Supported Events

| Event | Description | Database Status | SMS Sent |
|-------|-------------|----------------|----------|
| `Unpaid` | Invoice sent to customer | `pending` | No |
| `Paid` | Payment completed | `completed` | Yes ✅ |
| `PartiallyPaid` | Partial payment received | `partial` | No |
| `Failed` | Payment attempt failed | `failed` | Yes ✅ |
| `Cancelled` | Invoice cancelled | `cancelled` | No |
| `Voided` | Invoice voided | `cancelled` | No |

---

## 🚀 Quick Start

### Step 1: Deploy Your Functions

```bash
cd /Users/apple/Desktop/code/awslambda
serverless deploy --stage dev
```

**Note the webhook URL from the output:**
```
endpoints:
  POST - https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/webhook
```

### Step 2: Update Environment Variable

Update `.env` with your webhook URL:

```bash
WEBHOOK_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/webhook
```

### Step 3: Register Webhook

```bash
# List existing webhooks (if any)
node src/utils/webhookRegistration.js list

# Register new webhook with all events
node src/utils/webhookRegistration.js register
```

✅ **Done!** Your webhook is now registered and will receive all invoice events.

---

## 🔧 Webhook Registration

### Using the Utility Script

#### List All Notifications

```bash
node src/utils/webhookRegistration.js list
```

**Sample Output:**
```
✅ Found 2 notification(s):

1. ID: 12345
   Event Type: Invoice
   Events: Paid, PartiallyPaid, Unpaid, Failed, Cancelled, Voided
   URL: https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook
   Enabled: true
   Merchant ID: 1000156972
```

#### Register New Webhook

```bash
node src/utils/webhookRegistration.js register
```

This will register a webhook with ALL supported events:
- ✅ Paid
- ✅ PartiallyPaid
- ✅ Unpaid
- ✅ Failed
- ✅ Cancelled
- ✅ Voided

#### Update Existing Webhook

```bash
node src/utils/webhookRegistration.js update 12345
```

Replace `12345` with your actual notification ID.

#### Delete Webhook

```bash
node src/utils/webhookRegistration.js delete 12345
```

#### Get Available Event Types

```bash
node src/utils/webhookRegistration.js event-types
```

---

## 📡 Event Types & Monitoring

### Event Mapping

Your Lambda handler maps MX Merchant events to internal statuses:

| MX Event | Internal Status | Action Taken |
|----------|----------------|--------------|
| `Unpaid` | `pending` | Updates DB |
| `Paid` | `completed` | Updates DB + Sends SMS |
| `PartiallyPaid` | `partial` | Updates DB |
| `Failed` | `failed` | Updates DB + Sends SMS |
| `Cancelled` / `Voided` | `cancelled` | Updates DB |

### Enhanced Logging

Your webhook handler now includes emoji-prefixed logs for easy monitoring:

```
📥 WEBHOOK RECEIVED: Processing webhook event
✅ EVENT: Payment Completed
💾 DATABASE: Payment link status updated
📝 HISTORY: Event added to history
📱 SMS: ✅ Payment confirmation sent successfully
```

**Log Prefixes:**
- 📥 = Webhook received
- ✅ = Payment completed
- ❌ = Payment failed
- 💰 = Partial payment
- 🚫 = Cancelled/Voided
- 📤 = Invoice sent
- ⚠️ = Unknown event
- 💾 = Database update
- 📝 = History logged
- 📱 = SMS notification

### Viewing Logs in AWS

```bash
# View real-time logs
serverless logs -f handleWebhook --tail

# View last 100 lines
serverless logs -f handleWebhook -n 100

# View logs for specific time
serverless logs -f handleWebhook --startTime 5m
```

**Or in AWS Console:**
1. Go to CloudWatch → Log groups
2. Find `/aws/lambda/mx-lambda-api-dev-handleWebhook`
3. Click on latest log stream

---

## 🧪 Testing Webhooks

### Method 1: Manual Postman Test

#### 1. Create Test Webhook Payload

**Paid Invoice:**
```json
{
  "eventType": "invoice.paid",
  "invoiceId": 3000295,
  "status": "Paid",
  "invoice": {
    "id": 3000295,
    "invoiceNumber": "INV-2025-001",
    "status": "Paid",
    "totalAmount": 487.50,
    "paidAmount": 487.50,
    "balance": 0,
    "transactionId": "txn_abc123",
    "paymentMethod": "Visa - 4242",
    "customer": {
      "email": "customer@example.com",
      "name": "John Doe"
    }
  },
  "timestamp": "2025-10-10T14:30:00Z"
}
```

**Failed Invoice:**
```json
{
  "eventType": "invoice.failed",
  "invoiceId": 3000295,
  "status": "Failed",
  "invoice": {
    "id": 3000295,
    "invoiceNumber": "INV-2025-001",
    "status": "Failed",
    "totalAmount": 487.50,
    "paidAmount": 0,
    "balance": 487.50
  },
  "timestamp": "2025-10-10T14:30:00Z"
}
```

**Unpaid Invoice (Invoice Sent):**
```json
{
  "eventType": "invoice.sent",
  "invoiceId": 3000295,
  "status": "Unpaid",
  "invoice": {
    "id": 3000295,
    "invoiceNumber": "INV-2025-001",
    "status": "Unpaid",
    "totalAmount": 487.50,
    "paidAmount": 0,
    "balance": 487.50,
    "customer": {
      "email": "customer@example.com"
    }
  },
  "timestamp": "2025-10-10T14:30:00Z"
}
```

#### 2. Send via Postman

**Request:**
```
POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook
Content-Type: application/json

[Paste one of the above payloads]
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "af37e0cf-5eaa-4085-b88f-a2a130536ba6",
    "mxInvoiceId": "3000295",
    "mxInvoiceNumber": "INV-2025-001",
    "status": "completed",
    "eventType": "invoice.paid",
    "transactionId": "txn_abc123",
    "paidAmount": 487.50,
    "balance": 0,
    "paymentMethod": "Visa - 4242",
    "updatedAt": "2025-10-10T14:30:05.123Z",
    "smsNotification": {
      "sent": true,
      "messageSid": "SM1234567890",
      "status": "queued"
    }
  }
}
```

#### 3. Check Logs

```bash
serverless logs -f handleWebhook --tail
```

Look for:
```
📥 WEBHOOK RECEIVED: Processing webhook event
✅ EVENT: Payment Completed
💾 DATABASE: Payment link status updated
📝 HISTORY: Event added to history
📱 SMS: ✅ Payment confirmation sent successfully
```

### Method 2: Test with Real Invoice

#### 1. Create Invoice

```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "currency": "USD",
    "invoice": {
      "number": "TEST-001",
      "description": "Test Invoice for Webhook"
    },
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+13369539051"
    }
  }'
```

**Note the `mxInvoiceId` from response** (e.g., `3000295`)

#### 2. Complete Payment

1. Click the payment link from the response
2. Use test card: `4242 4242 4242 4242`
3. Expiry: Any future date (e.g., `12/25`)
4. CVV: Any 3 digits (e.g., `123`)
5. Submit payment

#### 3. Webhook Fires Automatically

MX Merchant will send webhook to your Lambda:
```
Paid event → Lambda processes → Database updated → SMS sent
```

#### 4. Check Database

Go to DynamoDB console or query:
```bash
aws dynamodb get-item \
  --table-name mx-lambda-api-dev-payment-links \
  --key '{"paymentLinkId": {"S": "YOUR-PAYMENT-LINK-ID"}}'
```

Look for:
- `status`: `completed`
- `eventHistory`: Array with events
- `transactionId`: Transaction ID from payment

---

## 🔍 Troubleshooting

### Webhook Not Firing

**1. Check Registration:**
```bash
node src/utils/webhookRegistration.js list
```

Verify:
- ✅ `enabled: true`
- ✅ Correct `notifyUrl`
- ✅ Events include desired types

**2. Check AWS API Gateway:**
- Go to API Gateway console
- Find your API
- Check "Stages" → "dev" → "Logs/Tracing"
- Enable CloudWatch Logs

**3. Check Lambda Permissions:**
- Your Lambda should be publicly accessible via API Gateway
- Check "Configuration" → "Permissions" in Lambda console

### Webhook Received but Not Processing

**1. Check Lambda Logs:**
```bash
serverless logs -f handleWebhook --tail
```

Look for errors:
```
❌ Failed to process webhook
Invoice not found in database
```

**2. Common Issues:**

| Error | Solution |
|-------|----------|
| `Invoice not found` | Check `mxInvoiceId` in DynamoDB matches webhook payload |
| `Invalid JSON` | Verify webhook payload structure |
| `Failed to send SMS` | Check Twilio credentials |
| `Failed to update database` | Check DynamoDB permissions |

### Database Not Updating

**1. Check Event History:**

In DynamoDB, check if `eventHistory` array is being populated:
```json
{
  "eventHistory": [
    {
      "eventType": "created",
      "status": "created",
      "timestamp": "2025-10-10T14:00:00Z",
      "source": "system",
      "description": "Payment link created"
    },
    {
      "eventType": "invoice.paid",
      "status": "completed",
      "timestamp": "2025-10-10T14:30:00Z",
      "source": "mx_merchant_webhook",
      "description": "Payment completed - $487.50"
    }
  ]
}
```

**2. Verify DynamoDB Permissions:**

Check `serverless.yml`:
```yaml
- Effect: Allow
  Action:
    - dynamodb:UpdateItem
    - dynamodb:PutItem
    - dynamodb:GetItem
    - dynamodb:Scan
  Resource: "arn:aws:dynamodb:us-east-1:*:table/mx-lambda-api-dev-payment-links"
```

### SMS Not Sending

**1. Check Logs for SMS Section:**
```
📱 SMS: Sending payment confirmation SMS
📱 SMS: ✅ Payment confirmation sent successfully
```

**2. Common Issues:**

| Log Message | Issue | Solution |
|-------------|-------|----------|
| `⚠️ No phone number on file` | Customer phone missing | Add phone to customer data |
| `❌ Failed to send SMS` | Twilio error | Check Twilio credentials |
| `ℹ️ No SMS notification needed` | Status doesn't trigger SMS | This is normal for `pending`/`partial` |

---

## 📊 Event History Tracking

### What Gets Tracked?

Every webhook event is now logged to DynamoDB's `eventHistory` array:

```json
{
  "eventType": "invoice.paid",
  "status": "completed",
  "timestamp": "2025-10-10T14:30:00Z",
  "source": "mx_merchant_webhook",
  "description": "Payment completed - $487.50",
  "metadata": {
    "transactionId": "txn_abc123",
    "paymentMethod": "Visa - 4242",
    "paidAmount": 487.50,
    "balance": 0,
    "invoiceNumber": "INV-2025-001",
    "receiptNumber": "RCP-2025-001",
    "rawEventType": "invoice.paid"
  }
}
```

### Viewing Event History

**Via DynamoDB Console:**
1. Go to DynamoDB → Tables → `mx-lambda-api-dev-payment-links`
2. Click "Explore table items"
3. Find your payment link
4. Expand `eventHistory` attribute

**Via API:**
```bash
curl https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links/YOUR-ID
```

Response includes full event history showing all status transitions.

---

## 🎯 Best Practices

### 1. Monitor Webhook Health

Set up CloudWatch Alarms for:
- Lambda errors > 1% in 5 minutes
- Lambda duration > 5 seconds
- DynamoDB throttles

### 2. Idempotency

The webhook handler is idempotent - receiving the same event multiple times won't cause duplicate SMS or incorrect status.

### 3. Event History

Use `eventHistory` for:
- ✅ Audit trail
- ✅ Debugging payment issues
- ✅ Customer support inquiries
- ✅ Analytics (time to payment, failure rates, etc.)

### 4. Testing Before Production

Always test webhooks in sandbox before switching to production:
```bash
# Use sandbox credentials in .env
MX_MERCHANT_API_URL=https://sandbox.api.mxmerchant.com/checkout/v3
WEBHOOK_URL=https://YOUR-SANDBOX-API.execute-api.us-east-1.amazonaws.com/dev/webhook
```

---

## 📞 Support

**Webhook Issues:**
- Check CloudWatch logs first
- Verify webhook registration: `node src/utils/webhookRegistration.js list`
- Test with manual payload in Postman

**MX Merchant API:**
- Documentation: https://developer.mxmerchant.com
- Support: Contact MX Merchant support

**AWS Lambda/DynamoDB:**
- Check IAM permissions
- Monitor CloudWatch metrics
- Review error logs

---

## ✅ Checklist

Before going to production:

- [ ] Webhook registered with all required events
- [ ] Webhook URL updated in `.env`
- [ ] Tested with sandbox environment
- [ ] Verified SMS notifications work
- [ ] Confirmed event history is logging correctly
- [ ] CloudWatch alarms configured
- [ ] Database backups enabled
- [ ] Error handling tested (invalid payloads, missing data)
- [ ] Switched to production credentials
- [ ] Re-registered webhook with production URL

---

🎉 **You're all set!** Your webhook integration is ready to receive real-time payment updates from MX Merchant.

