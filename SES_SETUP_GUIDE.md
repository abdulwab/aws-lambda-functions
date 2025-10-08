# AWS SES Email Setup Guide

## 🔴 Current Issue
AWS SES is in **Sandbox Mode** - emails cannot be sent to unverified addresses.

**Error:**
```
Email address is not verified in region US-EAST-2:
- info@celebrationchevrolet.com (sender)
- recipient emails (all recipients)
```

---

## ✅ Quick Fix - Verify Sender Email

### Step 1: Open SES Console
**Direct Link (US-EAST-2):**
```
https://us-east-2.console.aws.amazon.com/ses/home?region=us-east-2#/verified-identities
```

**Note:** Your Lambda is in `us-east-1`, but check your `.env` file for `AWS_REGION`. You might need to verify in both regions or update the Lambda region in `sesService.js`.

### Step 2: Create Identity
1. Click **"Create identity"** button
2. Select **"Email address"**
3. Enter: `info@celebrationchevrolet.com`
4. Click **"Create identity"**

### Step 3: Verify Email
1. Check the inbox for `info@celebrationchevrolet.com`
2. Look for email from `no-reply-aws@amazon.com`
3. Click the verification link
4. You'll see: "Congratulations! You have successfully verified..."

### Step 4: Verify Test Recipient (For Testing)
Repeat Steps 2-3 for: `umar@qvsslimited.com`

---

## 🚀 Production Fix - Move Out of Sandbox

### Why Move Out of Sandbox?
- ✅ Send to ANY email address (no verification needed)
- ✅ Higher sending limits
- ✅ Production-ready

### How to Request Production Access

1. **Open Account Dashboard:**
```
https://us-east-2.console.aws.amazon.com/ses/home?region=us-east-2#/account
```

2. **Click "Request production access"**

3. **Fill Out Form:**

**Mail type:** Transactional

**Website URL:** https://celebrationchevrolet.com

**Use case description:**
```
We are sending payment link notifications to our automotive repair customers. 
When a customer's vehicle service is complete, we send them an email with a 
secure payment link to pay their invoice. This is a transactional email that 
customers expect and have consented to receive.

Email volume: Approximately 50-100 emails per day
Recipients: Verified customers who have provided their email address
Content: Payment links, invoice details, and service information
```

**Additional contacts (optional):** Your email

**Acknowledge:** Check the box

4. **Submit Request**

5. **Wait for Approval** (Usually 24 hours, sometimes instant)

---

## 🔧 Fix Region Mismatch

Your Lambda is in `us-east-1` but your `.env` shows `AWS_REGION=us-east-2`.

### Option A: Update Lambda to Use us-east-2
```bash
# In sesService.js, the region is read from process.env.AWS_REGION
# Which is set to us-east-2 in your .env file
# So verify emails in us-east-2 region
```

### Option B: Update .env to Use us-east-1
```bash
# Change in .env file:
AWS_REGION=us-east-1

# Then verify emails in us-east-1 region
```

**Current Setup:** Your SES service is trying to send from `us-east-2`, so verify there.

---

## 🧪 Test After Verification

### With sendEmail: true and sendSMS: true
```bash
curl -X POST https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "invoice": {
      "number": "TEST-001",
      "description": "Test Payment"
    },
    "customer": {
      "name": "Test Customer",
      "email": "umar@qvsslimited.com",
      "phone": "+13369539051"
    },
    "sendEmail": true,
    "sendSMS": true
  }'
```

### Expected Response (After Verification):
```json
{
  "smsNotification": {
    "sent": true,
    "status": "sent",
    "messageSid": "SM..."
  },
  "emailNotification": {
    "sent": true,
    "status": "sent",
    "messageId": "..."
  }
}
```

---

## 📊 Check Verification Status

### In AWS Console:
1. Go to SES Verified Identities
2. Look for: `info@celebrationchevrolet.com`
3. Status should show: ✅ **Verified**

### Via CLI:
```bash
aws ses get-identity-verification-attributes \
  --identities info@celebrationchevrolet.com \
  --region us-east-2
```

---

## 🗄️ Check DynamoDB for Status

Your email/SMS status is now saved in DynamoDB:

```
https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=mx-lambda-api-dev-payment-links
```

Look for columns:
- `smsStatus`: sent / failed / not_sent
- `emailStatus`: sent / failed / not_sent
- `smsMessageSid`: Twilio message ID
- `emailMessageId`: SES message ID
- `smsSentAt`: Timestamp
- `emailSentAt`: Timestamp

---

## ⚡ Quick Checklist

- [ ] Open SES Console (us-east-2)
- [ ] Create identity for `info@celebrationchevrolet.com`
- [ ] Check email and click verification link
- [ ] Status shows "Verified"
- [ ] Test API with `sendEmail: true`
- [ ] Check DynamoDB for `emailStatus: "sent"`
- [ ] (Optional) Request production access

---

## 🎯 Current State

✅ **Payment Link Creation** - Working  
✅ **MX Merchant Integration** - Working  
✅ **DynamoDB Storage** - Working  
✅ **SMS Notifications** - Working (Twilio configured)  
⚠️ **Email Notifications** - Needs SES verification  

**After verification, your system will be 100% functional!** 🚀
