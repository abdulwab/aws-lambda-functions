# Deployment Guide

This guide covers deploying the MX Lambda API to AWS using the Serverless Framework.

## Prerequisites

### 1. AWS Account Setup
- AWS account with appropriate permissions
- AWS CLI configured with credentials
- IAM user with the following permissions:
  - Lambda (create, update, delete functions)
  - API Gateway (create, update, delete APIs)
  - DynamoDB (create, update, delete tables)
  - CloudFormation (create, update, delete stacks)
  - IAM (create, update, delete roles)

### 2. Local Development Setup
- Node.js 18+ installed
- npm or yarn package manager
- Serverless Framework installed globally: `npm install -g serverless`

### 3. Service Credentials
- MX Merchant API credentials (Consumer Key, Consumer Secret, Merchant ID)
- Twilio account credentials (Account SID, Auth Token, Phone Number)

## Environment Configuration

### 1. Copy Environment Template
```bash
cp env.example .env
```

### 2. Configure Environment Variables
Edit `.env` file with your actual credentials:

```bash
# MX Merchant API Configuration
MX_MERCHANT_API_URL=https://sandbox.api.mxmerchant.com/checkout/v3
MX_MERCHANT_CONSUMER_KEY=your_actual_consumer_key
MX_MERCHANT_CONSUMER_SECRET=your_actual_consumer_secret
MX_MERCHANT_MERCHANT_ID=your_actual_merchant_id

# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_actual_twilio_account_sid
TWILIO_AUTH_TOKEN=your_actual_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# AWS Configuration
AWS_REGION=us-east-1
STAGE=dev
```

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Deploy to Development
```bash
# Using npm script
npm run deploy:dev

# Or using serverless directly
serverless deploy --stage dev
```

### 4. Deploy to Production
```bash
# Using npm script
npm run deploy:prod

# Or using serverless directly
serverless deploy --stage prod
```

### 5. Using Deployment Script
```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to development
./scripts/deploy.sh dev

# Deploy to production
./scripts/deploy.sh prod
```

## Post-Deployment Configuration

### 1. Get API Endpoints
After deployment, note the API Gateway endpoints:
```bash
serverless info --stage dev
```

### 2. Configure MX Merchant Webhooks
Set up webhook endpoints in your MX Merchant dashboard:
- **Development**: `https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/webhook`
- **Production**: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/webhook`

### 3. Test Deployment
```bash
# Test API endpoints
./scripts/test-api.sh dev

# Test locally
npm run local
```

## Infrastructure Overview

### AWS Resources Created
- **Lambda Functions**:
  - `createPaymentLink`: Creates payment links
  - `handleWebhook`: Processes webhook notifications
  - `getPaymentStatus`: Retrieves payment status

- **API Gateway**:
  - REST API with CORS enabled
  - Three endpoints: POST /payment-links, GET /payment-links/{id}, POST /webhook

- **DynamoDB**:
  - Table: `mx-lambda-api-{stage}-payment-links`
  - TTL enabled (30 days)
  - Global Secondary Index on `createdAt`

- **IAM Roles**:
  - Lambda execution role
  - DynamoDB access permissions

### Environment-Specific Resources
- **Development**: `mx-lambda-api-dev-*`
- **Production**: `mx-lambda-api-prod-*`

## Monitoring and Logging

### CloudWatch Logs
- All Lambda functions log to CloudWatch
- Structured JSON logging with request IDs
- Error tracking and performance metrics

### Monitoring Setup
1. Set up CloudWatch alarms for:
   - Lambda function errors
   - API Gateway 4xx/5xx responses
   - DynamoDB throttling

2. Configure notifications for:
   - High error rates
   - Performance degradation
   - Service failures

## Security Considerations

### 1. Environment Variables
- Never commit `.env` files to version control
- Use AWS Systems Manager Parameter Store for production secrets
- Rotate credentials regularly

### 2. API Security
- Enable API Gateway request validation
- Implement rate limiting
- Use HTTPS only
- Validate webhook signatures (when available)

### 3. DynamoDB Security
- Enable encryption at rest
- Use least-privilege IAM policies
- Enable point-in-time recovery

## Troubleshooting

### Common Issues

#### 1. Deployment Failures
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify serverless configuration
serverless print --stage dev
```

#### 2. Lambda Function Errors
- Check CloudWatch logs
- Verify environment variables
- Test functions locally

#### 3. API Gateway Issues
- Check CORS configuration
- Verify endpoint paths
- Test with Postman or curl

#### 4. DynamoDB Issues
- Check table permissions
- Verify table exists
- Check item TTL settings

### Debug Commands
```bash
# View serverless logs
serverless logs -f createPaymentLink --stage dev

# Invoke function locally
serverless invoke local -f createPaymentLink --stage dev

# Check deployment status
serverless info --stage dev
```

## Rollback Procedures

### 1. Rollback to Previous Version
```bash
# List previous deployments
serverless deploy list --stage prod

# Rollback to specific version
serverless rollback --timestamp 1234567890 --stage prod
```

### 2. Emergency Rollback
```bash
# Remove entire stack
serverless remove --stage prod

# Redeploy previous version
serverless deploy --stage prod
```

## Cost Optimization

### 1. Lambda Configuration
- Use appropriate memory allocation
- Set reasonable timeout values
- Enable provisioned concurrency for production

### 2. DynamoDB Configuration
- Use on-demand billing for variable workloads
- Set appropriate TTL for automatic cleanup
- Monitor read/write capacity usage

### 3. API Gateway
- Enable caching where appropriate
- Use compression
- Monitor usage patterns

## Maintenance

### Regular Tasks
1. **Weekly**:
   - Review CloudWatch logs
   - Check error rates
   - Monitor performance metrics

2. **Monthly**:
   - Review and rotate credentials
   - Update dependencies
   - Review cost reports

3. **Quarterly**:
   - Security audit
   - Performance optimization
   - Disaster recovery testing

## Support

For deployment issues:
1. Check CloudWatch logs
2. Review serverless documentation
3. Contact the development team
4. Check AWS service status

## Production Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] MX Merchant webhooks configured
- [ ] Twilio credentials verified
- [ ] Monitoring and alerting set up
- [ ] Backup and recovery procedures tested
- [ ] Security review completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team trained on new system
