# 📮 Postman Testing Guide - MX Lambda API

## 🎯 Quick Setup

**API Base URL:** `https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev`

**Authentication:** ❌ No API key or token required (currently open API)

---

## 1️⃣ Create Payment Link

### Request Details:
- **Method:** `POST`
- **URL:** `https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links`
- **Headers:**
  ```
  Content-Type: application/json
  ```

### Request Body (JSON):

#### Minimal Request:
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
  "sendSMS": false
}
```

#### Full Request with Line Items:
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
      "description": "Brake Rotor Resurfacing",
      "quantity": 2,
      "unitPrice": 75.00,
      "totalPrice": 150.00
    },
    {
      "description": "Labor - Brake Service",
      "quantity": 2.5,
      "unitPrice": 75.00,
      "totalPrice": 187.50
    }
  ],
  "sendSMS": true,
  "redirectUrl": "https://celebrationchevrolet.com/payment/success",
  "cancelUrl": "https://celebrationchevrolet.com/payment/cancel"
}
```

### Expected Success Response (200/201):
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
    "invoice": {
      "number": "RO-252656",
      "description": "Brake Service Complete - 2019 Silverado 1500"
    },
    "customer": {
      "name": "Sarah Johnson",
      "email": "sarah.johnson@email.com",
      "phone": "+15551234567"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "smsNotification": {
      "sent": true,
      "messageSid": "SM1234567890",
      "status": "sent"
    }
  }
}
```

### Expected Error Response (400):
```json
{
  "success": false,
  "error": {
    "message": "Missing required fields: invoice, customer",
    "details": null
  }
}
```

### Expected Error Response (500):
```json
{
  "success": false,
  "error": {
    "message": "Failed to create payment link",
    "details": "Payment link creation failed: Invalid username or password. Please try again."
  }
}
```

---

## 2️⃣ Get Payment Status

### Request Details:
- **Method:** `GET`
- **URL:** `https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links/{paymentLinkId}`
- **Headers:**
  ```
  Content-Type: application/json
  ```

### Example URL:
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links/550e8400-e29b-41d4-a716-446655440000
```

### No Request Body Required (GET request)

### Expected Success Response (200):
```json
{
  "success": true,
  "data": {
    "paymentLinkId": "550e8400-e29b-41d4-a716-446655440000",
    "mxPaymentLinkId": "pl_12345abc",
    "status": "completed",
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
    "checkoutUrl": "https://sandbox.mxmerchant.com/checkout/pl_12345abc",
    "transactionId": "txn_12345",
    "completedAt": "2024-01-15T10:45:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:45:00.000Z",
    "lastSyncAt": "2024-01-15T10:45:00.000Z"
  }
}
```

### Expected Error Response (404):
```json
{
  "success": false,
  "error": {
    "message": "Payment link not found",
    "details": null
  }
}
```

---

## 3️⃣ Handle Webhook (Simulate MX Merchant)

### Request Details:
- **Method:** `POST`
- **URL:** `https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/webhook`
- **Headers:**
  ```
  Content-Type: application/json
  ```

### Request Body - Payment Completed:
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

### Request Body - Payment Failed:
```json
{
  "paymentLinkId": "pl_12345abc",
  "eventType": "payment.failed",
  "status": "failed",
  "amount": 487.50,
  "currency": "USD",
  "timestamp": "2024-01-15T10:45:00Z",
  "failureReason": "Insufficient funds"
}
```

### Expected Success Response (200):
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## 📋 Field Descriptions

### Create Payment Link - Required Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | Number | ✅ Yes | Payment amount (e.g., 487.50) |
| `currency` | String | ❌ No | Currency code (default: "USD") |
| `invoice.number` | String | ✅ Yes | Invoice/RO number |
| `invoice.description` | String | ❌ No | Invoice description |
| `customer.name` | String | ✅ Yes | Customer full name |
| `customer.email` | String | ✅ Yes | Customer email address |
| `customer.phone` | String | ❌ No | Customer phone (for SMS) |
| `lineItems` | Array | ❌ No | Array of line items |
| `sendSMS` | Boolean | ❌ No | Send SMS notification (default: true if phone provided) |
| `redirectUrl` | String | ❌ No | Success redirect URL |
| `cancelUrl` | String | ❌ No | Cancel redirect URL |

### Line Item Structure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | String | ✅ Yes | Item description |
| `quantity` | Number | ✅ Yes | Item quantity |
| `unitPrice` | Number | ✅ Yes | Price per unit |
| `totalPrice` | Number | ✅ Yes | Total price (quantity × unitPrice) |

---

## 🧪 Postman Collection Setup

### Step 1: Create New Collection
1. Open Postman
2. Click "New Collection"
3. Name it: "MX Lambda API"

### Step 2: Create Environment
1. Click "Environments" in left sidebar
2. Create new environment: "AWS Dev"
3. Add variables:
   ```
   base_url = https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev
   payment_link_id = (leave empty, will be set from response)
   ```

### Step 3: Add Requests

#### Request 1: Create Payment Link
- Name: "Create Payment Link"
- Method: POST
- URL: `{{base_url}}/payment-links`
- Headers: `Content-Type: application/json`
- Body: Use the full JSON example above
- Tests (to save payment_link_id):
  ```javascript
  if (pm.response.code === 201) {
      const response = pm.response.json();
      pm.environment.set("payment_link_id", response.data.paymentLinkId);
  }
  ```

#### Request 2: Get Payment Status
- Name: "Get Payment Status"
- Method: GET
- URL: `{{base_url}}/payment-links/{{payment_link_id}}`
- Headers: `Content-Type: application/json`

#### Request 3: Simulate Webhook
- Name: "Simulate Webhook - Payment Completed"
- Method: POST
- URL: `{{base_url}}/webhook`
- Headers: `Content-Type: application/json`
- Body: Use webhook JSON example above

---

## 🔄 Test Flow

### Complete Test Sequence:

1. **Create Payment Link**
   - Send POST request with customer data
   - Save `paymentLinkId` from response
   - Note the `checkoutUrl`

2. **Check Status**
   - Send GET request with saved `paymentLinkId`
   - Verify status is "created"

3. **Simulate Payment**
   - Send webhook POST with "payment.completed"
   - Use the `mxPaymentLinkId` from step 1

4. **Check Status Again**
   - Send GET request again
   - Verify status changed to "completed"

---

## 🎨 Pre-filled Example Requests

### Example 1: Small Payment
```json
{
  "amount": 50.00,
  "currency": "USD",
  "invoice": {
    "number": "INV-001",
    "description": "Oil Change Service"
  },
  "customer": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+15551234567"
  },
  "sendSMS": false
}
```

### Example 2: Large Payment with Multiple Items
```json
{
  "amount": 1250.75,
  "currency": "USD",
  "invoice": {
    "number": "RO-789456",
    "description": "Complete Brake System Overhaul"
  },
  "customer": {
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "phone": "+15559876543"
  },
  "lineItems": [
    {
      "description": "Front Brake Pads",
      "quantity": 1,
      "unitPrice": 125.00,
      "totalPrice": 125.00
    },
    {
      "description": "Rear Brake Pads",
      "quantity": 1,
      "unitPrice": 110.00,
      "totalPrice": 110.00
    },
    {
      "description": "Brake Rotors (All 4)",
      "quantity": 4,
      "unitPrice": 85.00,
      "totalPrice": 340.00
    },
    {
      "description": "Brake Fluid Flush",
      "quantity": 1,
      "unitPrice": 75.00,
      "totalPrice": 75.00
    },
    {
      "description": "Labor",
      "quantity": 4.5,
      "unitPrice": 133.50,
      "totalPrice": 600.75
    }
  ],
  "sendSMS": true
}
```

### Example 3: Minimal Request
```json
{
  "amount": 99.99,
  "invoice": {
    "number": "TEST-123"
  },
  "customer": {
    "name": "Test Customer",
    "email": "test@test.com"
  }
}
```

---

## 📊 Response Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Successful GET request |
| 201 | Created | Payment link created successfully |
| 400 | Bad Request | Missing required fields or invalid data |
| 404 | Not Found | Payment link ID doesn't exist |
| 500 | Internal Server Error | MX Merchant API error or server issue |

---

## 🐛 Common Errors & Solutions

### Error: "Missing required fields"
**Solution:** Ensure you include:
- `amount`
- `invoice.number`
- `customer.name`
- `customer.email`

### Error: "Valid amount is required"
**Solution:** Amount must be a positive number (not string):
```json
"amount": 100.00  ✅ Correct
"amount": "100.00"  ❌ Wrong
```

### Error: "Invalid username or password"
**Solution:** This is an MX Merchant credential issue. The API is working, but needs valid sandbox credentials from MX Merchant.

### Error: "Payment link not found"
**Solution:** The `paymentLinkId` in the URL doesn't exist in the database. Check you're using the correct ID from the create response.

---

## 💡 Pro Tips

1. **Save Environment Variables**: Use Postman's environment variables to avoid copying IDs manually
2. **Use Test Scripts**: Add JavaScript tests to automatically save response data
3. **Organize Folders**: Create folders for different test scenarios
4. **Export Collection**: Share your Postman collection with teammates
5. **Monitor Responses**: Check response times and status codes

---

## 📥 Import Ready Collection

You can also import this Postman collection JSON directly:

**File:** `postman-collection.json` (will create this next)

---

**Your API is ready to test!** 🚀

Start with the minimal request example to test the basic flow.
