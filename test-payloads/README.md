# 🧪 Webhook Test Payloads

This directory contains test payloads for manually testing webhook functionality.

## 📋 Available Test Payloads

All payloads are in `webhook-test-payloads.json`:

1. **paid_event** - Invoice fully paid ✅
2. **failed_event** - Payment attempt failed ❌
3. **unpaid_event** - Invoice sent to customer 📤
4. **partial_payment_event** - Partial payment received 💰
5. **cancelled_event** - Invoice cancelled 🚫
6. **voided_event** - Invoice voided 🚫

## 🚀 Quick Test with curl

### 1. First, Create a Test Invoice

```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 487.50,
    "currency": "USD",
    "invoice": {
      "number": "INV-2025-001",
      "description": "Test Invoice for Webhook"
    },
    "customer": {
      "name": "John Doe",
      "email": "customer@example.com",
      "phone": "+13369539051"
    }
  }'
```

**Note:** Copy the `mxInvoiceId` from the response (e.g., `3000295`)

### 2. Test Unpaid Event (Invoice Sent)

```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook \
  -H "Content-Type: application/json" \
  -d '{
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
    "timestamp": "2025-10-10T14:25:00Z"
  }'
```

### 3. Test Paid Event (Payment Completed)

```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook \
  -H "Content-Type: application/json" \
  -d '{
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
      "transactionId": "txn_abc123xyz",
      "receiptNumber": "RCP-2025-001",
      "paymentMethod": "Visa - 4242",
      "customer": {
        "email": "customer@example.com",
        "name": "John Doe"
      }
    },
    "timestamp": "2025-10-10T14:30:00Z"
  }'
```

### 4. Test Failed Event

```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "invoice.failed",
    "invoiceId": 3000295,
    "status": "Failed",
    "invoice": {
      "id": 3000295,
      "invoiceNumber": "INV-2025-001",
      "status": "Failed",
      "totalAmount": 487.50,
      "paidAmount": 0,
      "balance": 487.50,
      "customer": {
        "email": "customer@example.com"
      }
    },
    "metadata": {
      "reason": "Card declined - insufficient funds"
    },
    "timestamp": "2025-10-10T14:30:00Z"
  }'
```

## 📱 Expected Results

### Unpaid Event
- ✅ Database status: `pending`
- ✅ Event added to history
- ❌ No SMS sent

### Paid Event
- ✅ Database status: `completed`
- ✅ Event added to history
- ✅ SMS sent: "Your payment of $487.50 for invoice INV-2025-001 has been received..."

### Failed Event
- ✅ Database status: `failed`
- ✅ Event added to history
- ✅ SMS sent: "Payment for invoice INV-2025-001 failed..."

## 🔍 Monitoring

### View Logs
```bash
serverless logs -f handleWebhook --tail
```

### Check Database
1. Go to AWS Console → DynamoDB
2. Find table: `mx-lambda-api-dev-payment-links`
3. Search for `paymentLinkId` from response
4. Check:
   - `status` field
   - `eventHistory` array
   - `transactionId` (for paid events)

### What to Look For in Logs

**Unpaid Event:**
```
📥 WEBHOOK RECEIVED: Processing webhook event
📤 EVENT: Invoice Sent/Unpaid
💾 DATABASE: Payment link status updated
📝 HISTORY: Event added to history
📱 SMS: ℹ️ No SMS notification needed for status
```

**Paid Event:**
```
📥 WEBHOOK RECEIVED: Processing webhook event
✅ EVENT: Payment Completed
💾 DATABASE: Payment link status updated
📝 HISTORY: Event added to history
📱 SMS: Sending payment confirmation SMS
📱 SMS: ✅ Payment confirmation sent successfully
```

**Failed Event:**
```
📥 WEBHOOK RECEIVED: Processing webhook event
❌ EVENT: Payment Failed
💾 DATABASE: Payment link status updated
📝 HISTORY: Event added to history
📱 SMS: Sending payment failure SMS
📱 SMS: ✅ Payment failure notification sent
```

## 🎯 Testing Checklist

- [ ] Created test invoice via `/payment-links`
- [ ] Noted `mxInvoiceId` and `paymentLinkId`
- [ ] Tested `Unpaid` event
- [ ] Verified DB status changed to `pending`
- [ ] Tested `Paid` event
- [ ] Verified DB status changed to `completed`
- [ ] Verified SMS sent for paid event
- [ ] Tested `Failed` event
- [ ] Verified SMS sent for failed event
- [ ] Checked `eventHistory` array has all events
- [ ] Verified timestamps are correct
- [ ] Checked CloudWatch logs show emoji prefixes

## 💡 Tips

1. **Use same `invoiceId`** for all test events to see status progression
2. **Check logs between each test** to see event processing
3. **Verify SMS** - check phone for actual messages (or check Twilio logs)
4. **Event History** - Each webhook should add entry to `eventHistory` array
5. **Idempotency** - Sending same event twice won't duplicate actions

## 🐛 Troubleshooting

**Error: "Invoice not found in database"**
- Make sure you created invoice first via `/payment-links`
- Use correct `mxInvoiceId` in webhook payload

**Error: "Invalid JSON in webhook payload"**
- Check JSON syntax (missing commas, brackets, etc.)
- Use `jq` to validate: `cat payload.json | jq .`

**SMS not sending:**
- Check Twilio credentials in `.env`
- Verify phone number format: `+1` prefix required
- Check Twilio logs for delivery status

**Status not updating:**
- Check Lambda IAM permissions for DynamoDB
- Verify DynamoDB table exists
- Check CloudWatch logs for errors

---

Need help? Check `WEBHOOK_GUIDE.md` for complete documentation.

