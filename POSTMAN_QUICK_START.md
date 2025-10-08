# 🚀 Postman Quick Start - Copy & Paste Ready

## 📍 API Base URL
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev
```

---

## 1️⃣ CREATE PAYMENT LINK

### Method: `POST`
### URL:
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links
```

### Headers:
```
Content-Type: application/json
```

### Body (Copy & Paste):
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
    },
    {
      "description": "Labor",
      "quantity": 2.5,
      "unitPrice": 75.00,
      "totalPrice": 187.50
    }
  ],
  "sendSMS": false
}
```

---

## 2️⃣ GET PAYMENT STATUS

### Method: `GET`
### URL (Replace {id} with actual payment link ID):
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links/{id}
```

### Headers:
```
Content-Type: application/json
```

### No Body Required ✅

---

## 3️⃣ SIMULATE WEBHOOK

### Method: `POST`
### URL:
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook
```

### Headers:
```
Content-Type: application/json
```

### Body (Copy & Paste):
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

---

## 📥 Import Postman Collection

**Import this file directly into Postman:**
```
MX-Lambda-API.postman_collection.json
```

**Steps:**
1. Open Postman
2. Click "Import" button (top left)
3. Drag & drop the file `MX-Lambda-API.postman_collection.json`
4. Done! All requests are pre-configured ✅

---

## 🎯 Quick Test Sequence

### Step 1: Create Payment Link
1. Open request "1. Create Payment Link"
2. Click "Send"
3. Copy `paymentLinkId` from response

### Step 2: Check Status
1. Open request "2. Get Payment Status"
2. Replace `{{payment_link_id}}` in URL with copied ID
3. Click "Send"

### Step 3: Simulate Payment
1. Open request "3. Webhook - Payment Completed"
2. Click "Send"

---

## ✅ Expected Response

### Success (201 Created):
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "550e8400-e29b-41d4-a716-446655440000",
    "mxPaymentLinkId": "pl_12345abc",
    "checkoutUrl": "https://sandbox.mxmerchant.com/checkout/pl_12345abc",
    "status": "created",
    "amount": 487.50,
    "currency": "USD",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "smsNotification": {
      "sent": false,
      "reason": "No phone number provided"
    }
  }
}
```

### Error (500 - MX Credentials Issue):
```json
{
  "success": false,
  "error": {
    "message": "Failed to create payment link",
    "details": "Payment link creation failed: Invalid username or password. Please try again."
  }
}
```

**Note:** The credential error means AWS Lambda is working perfectly! You just need valid MX Merchant sandbox credentials.

---

## 🔑 No Authentication Required

Your API currently doesn't require:
- ❌ API Keys
- ❌ Bearer Tokens
- ❌ Basic Auth
- ❌ OAuth

Just send the request! 🎉

---

## 📝 Minimal Test Payload

If you want to test with minimal data:

```json
{
  "amount": 100.00,
  "invoice": {
    "number": "TEST-001"
  },
  "customer": {
    "name": "Test User",
    "email": "test@test.com"
  }
}
```

---

## 🎨 Multiple Test Examples

### Small Payment ($50):
```json
{
  "amount": 50.00,
  "invoice": { "number": "INV-001", "description": "Oil Change" },
  "customer": { "name": "John Doe", "email": "john@example.com" }
}
```

### Large Payment ($1,250):
```json
{
  "amount": 1250.00,
  "invoice": { "number": "RO-789", "description": "Engine Repair" },
  "customer": { "name": "Jane Smith", "email": "jane@example.com", "phone": "+15559876543" },
  "sendSMS": false
}
```

---

## 🐛 Troubleshooting

### "Missing required fields"
✅ Make sure you include: `amount`, `invoice.number`, `customer.name`, `customer.email`

### "Valid amount is required"
✅ Amount must be a number, not a string:
```json
"amount": 100.00  ✅ Correct
"amount": "100"   ❌ Wrong
```

### "Invalid username or password"
✅ This is from MX Merchant API - your Lambda is working fine!

---

## 📊 HTTP Status Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | ✅ OK | GET request successful |
| 201 | ✅ Created | Payment link created |
| 400 | ❌ Bad Request | Invalid data |
| 404 | ❌ Not Found | Payment link doesn't exist |
| 500 | ❌ Server Error | MX Merchant or server issue |

---

**Ready to test!** 🚀

Start with the "Create Payment Link - Minimal" request for the quickest test.
