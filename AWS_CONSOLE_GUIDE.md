# AWS Console Guide - View Your Deployed Resources

## 🚀 Your Deployed Application

**Project:** MX Lambda API  
**Stage:** dev  
**Region:** us-east-1  

---

## 1️⃣ Lambda Functions Console

### Access Lambda Dashboard:
🔗 **https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions**

### What You'll See:
You'll find **3 Lambda functions** listed:

1. **mx-lambda-api-dev-createPaymentLink**
   - Runtime: Node.js 18.x
   - Size: ~23 MB
   - Handles: Creating payment links
   - Endpoint: POST /payment-links

2. **mx-lambda-api-dev-handleWebhook**
   - Runtime: Node.js 18.x
   - Size: ~23 MB
   - Handles: Processing MX Merchant webhooks
   - Endpoint: POST /webhook

3. **mx-lambda-api-dev-getPaymentStatus**
   - Runtime: Node.js 18.x
   - Size: ~23 MB
   - Handles: Retrieving payment status
   - Endpoint: GET /payment-links/{id}

### Direct Links to Each Function:
- [createPaymentLink](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/mx-lambda-api-dev-createPaymentLink)
- [handleWebhook](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/mx-lambda-api-dev-handleWebhook)
- [getPaymentStatus](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/mx-lambda-api-dev-getPaymentStatus)

### In Each Function You Can:
- ✅ View code inline
- ✅ See environment variables
- ✅ Monitor invocations
- ✅ Test the function
- ✅ View CloudWatch logs
- ✅ Configure memory/timeout
- ✅ See recent invocations and errors

---

## 2️⃣ API Gateway Console

### Access API Gateway:
🔗 **https://us-east-1.console.aws.amazon.com/apigateway/main/apis?region=us-east-1**

### What You'll See:
**API Name:** mx-lambda-api-dev

**Endpoints:**
- POST   `/payment-links` → createPaymentLink Lambda
- GET    `/payment-links/{id}` → getPaymentStatus Lambda
- POST   `/webhook` → handleWebhook Lambda

**Your API Base URL:**
```
https://mnt4wit22f.execute-api.us-east-1.amazonaws.com/dev
```

### In API Gateway You Can:
- ✅ View all routes and methods
- ✅ Test endpoints directly
- ✅ Monitor API calls
- ✅ Configure throttling
- ✅ Set up custom domains
- ✅ Enable API keys
- ✅ View access logs

---

## 3️⃣ DynamoDB Console

### Access DynamoDB:
🔗 **https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#tables**

### What You'll See:
**Table Name:** `mx-lambda-api-dev-payment-links`

**Schema:**
- **Primary Key:** paymentLinkId (String)
- **GSI:** CreatedAtIndex (on createdAt attribute)
- **Billing:** Pay-per-request (on-demand)

### In DynamoDB You Can:
- ✅ Browse stored payment links
- ✅ Query by ID or creation date
- ✅ View table metrics
- ✅ Monitor read/write capacity
- ✅ Export data
- ✅ Create backups

---

## 4️⃣ CloudWatch Logs Console

### Access CloudWatch Logs:
🔗 **https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups**

### What You'll See:
**3 Log Groups:**
1. `/aws/lambda/mx-lambda-api-dev-createPaymentLink`
2. `/aws/lambda/mx-lambda-api-dev-handleWebhook`
3. `/aws/lambda/mx-lambda-api-dev-getPaymentStatus`

### In CloudWatch You Can:
- ✅ View real-time logs
- ✅ Search log events
- ✅ See error traces
- ✅ Monitor performance
- ✅ Set up alarms
- ✅ Create log insights queries

---

## 5️⃣ CloudFormation Console

### Access CloudFormation:
🔗 **https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks**

### What You'll See:
**Stack Name:** `mx-lambda-api-dev`

**Status:** CREATE_COMPLETE or UPDATE_COMPLETE

### In CloudFormation You Can:
- ✅ View all created resources
- ✅ See deployment events
- ✅ View template used
- ✅ Check stack outputs
- ✅ Monitor stack health

---

## 6️⃣ IAM Roles Console

### Access IAM:
🔗 **https://console.aws.amazon.com/iam/home?region=us-east-1#/roles**

### What You'll See:
**Role Name:** `mx-lambda-api-dev-us-east-1-lambdaRole`

**Permissions:**
- Lambda execution permissions
- DynamoDB read/write permissions
- CloudWatch Logs permissions

---

## 🔍 Quick Access Steps

### To View Lambda Functions:
1. Go to AWS Console: https://console.aws.amazon.com
2. Sign in with your credentials
3. Search for "Lambda" in the top search bar
4. Click on "Lambda" service
5. Make sure region is set to "US East (N. Virginia)" / us-east-1
6. You'll see your 3 functions listed!

### To Test a Function:
1. Click on any function (e.g., `mx-lambda-api-dev-createPaymentLink`)
2. Go to "Test" tab
3. Create a test event with sample JSON
4. Click "Test" to run it
5. See results and logs instantly

---

## 📊 Monitoring & Metrics

### View Real-Time Metrics:
Each Lambda function has a "Monitor" tab showing:
- ✅ Number of invocations
- ✅ Success/error rates
- ✅ Duration (execution time)
- ✅ Throttles
- ✅ Concurrent executions

### View Recent Logs:
```bash
# From your terminal
serverless logs -f createPaymentLink --stage dev --tail
```

Or click "View CloudWatch logs" in any function's console page.

---

## 💰 Cost Monitoring

### View Billing:
🔗 **https://console.aws.amazon.com/billing/home**

**Expected Costs (Free Tier):**
- Lambda: First 1M requests/month FREE
- API Gateway: First 1M calls/month FREE
- DynamoDB: 25GB storage FREE
- CloudWatch Logs: 5GB FREE

For typical usage, this app should stay within free tier! 🎉

---

## 🔐 Security

**Your credentials are stored as:**
- Lambda environment variables (encrypted at rest)
- Not visible in function code
- Accessible only to the Lambda execution role

---

## 🎯 Next Steps

1. ✅ Open AWS Console and explore your functions
2. ✅ Check CloudWatch logs for the test we ran
3. ✅ View the DynamoDB table (it's empty until we get valid MX credentials)
4. ✅ Test functions using the AWS Console test feature

**Your application is live and ready!** 🚀
