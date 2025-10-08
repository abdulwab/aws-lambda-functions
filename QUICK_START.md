# Quick Start Guide - MX Lambda API

This guide will get your MX Lambda API deployed to AWS and ready for integration with your 3CX Caller Pop system.

## 🚀 Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured: `aws configure`
3. **Node.js 18+** installed
4. **Yarn** package manager
5. **Serverless Framework**: `npm install -g serverless`

## 📋 Required Credentials

You'll need these credentials before deployment:

### MX Merchant API
- ✅ **Consumer Key**: `OjWxiOcjfQLJqCTZseLTKAlf` (already provided)
- ✅ **Consumer Secret**: `q6VOBlElPyIoHEvS33p3Dkr1Xik=` (already provided)
- ✅ **Merchant ID**: `1000131016` (already provided)

### Twilio SMS (You need to get these)
- 🔑 **Account SID**: Get from [Twilio Console](https://console.twilio.com/)
- 🔑 **Auth Token**: Get from [Twilio Console](https://console.twilio.com/)
- 🔑 **Phone Number**: Get from [Twilio Console](https://console.twilio.com/)

## ⚡ Quick Deployment

### Step 1: Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your Twilio credentials
nano .env
```

Update these values in your `.env` file:
```bash
TWILIO_ACCOUNT_SID=your_actual_twilio_account_sid
TWILIO_AUTH_TOKEN=your_actual_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 2: Install Dependencies
```bash
yarn install
```

### Step 3: Deploy to AWS
```bash
# Deploy to development
./scripts/deploy.sh dev
```

### Step 4: Test the API
```bash
# Test the deployed API
./scripts/test-deployed-api.sh dev
```

## 🎯 What Gets Deployed

- **3 Lambda Functions**:
  - `createPaymentLink` - Creates MX Merchant payment links
  - `handleWebhook` - Processes payment status updates
  - `getPaymentStatus` - Retrieves payment status

- **API Gateway** with 3 endpoints:
  - `POST /payment-links` - Create payment link
  - `GET /payment-links/{id}` - Get payment status
  - `POST /webhook` - Handle webhooks

- **DynamoDB Table** for storing payment link records

## 🔧 Post-Deployment Configuration

### 1. Get Your API URL
After deployment, you'll see output like:
```
🌐 API Endpoints:
  Base URL: https://abc123.execute-api.us-east-1.amazonaws.com/dev
```

### 2. Configure MX Merchant Webhook
In your MX Merchant dashboard, set the webhook URL to:
```
https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/webhook
```

### 3. Test with Real Data
```bash
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/payment-links \
  -H "Content-Type: application/json" \
  -d '{
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
    "sendSMS": true
  }'
```

## 🔗 Integration with 3CX Caller Pop

Once deployed, your 3CX Caller Pop system can:

1. **Create Payment Links**: Call the `/payment-links` endpoint when "Send Payment Link" is clicked
2. **Check Status**: Call the `/payment-links/{id}` endpoint to check payment status
3. **Receive Updates**: MX Merchant will send webhooks to your `/webhook` endpoint

### Example Integration Code
```javascript
// In your 3CX Caller Pop system
const createPaymentLink = async (invoiceData) => {
  const response = await fetch('https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/payment-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: invoiceData.totalAmount,
      invoice: {
        number: invoiceData.roNumber,
        description: invoiceData.description
      },
      customer: {
        name: invoiceData.customerName,
        email: invoiceData.customerEmail,
        phone: invoiceData.customerPhone
      },
      sendSMS: true
    })
  });
  
  const result = await response.json();
  return result.data.checkoutUrl; // Send this URL to customer
};
```

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Not Found**
   - Make sure your `.env` file exists and has correct values
   - Check that Twilio credentials are valid

2. **AWS Permissions Error**
   - Ensure your AWS CLI is configured: `aws sts get-caller-identity`
   - Check IAM permissions for Lambda, API Gateway, and DynamoDB

3. **Deployment Fails**
   - Check AWS region is set correctly
   - Ensure Serverless Framework is installed globally

### Getting Help

- Check CloudWatch logs for detailed error information
- Run `serverless info --stage dev` to see deployment details
- Verify all environment variables are set correctly

## 📞 Next Steps

1. ✅ Deploy to development
2. ✅ Test API endpoints
3. ✅ Configure MX Merchant webhook
4. 🔄 Integrate with 3CX Caller Pop
5. 🚀 Deploy to production when ready

Your MX Lambda API is now ready to handle payment link creation and processing for Celebration Chevrolet!
