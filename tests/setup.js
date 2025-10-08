/**
 * Jest test setup file
 */

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      get: jest.fn().mockReturnThis(),
      put: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      scan: jest.fn().mockReturnThis(),
      promise: jest.fn()
    }))
  }
}));

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SM1234567890',
        status: 'sent'
      })
    }
  }));
});

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  }))
}));

// Set environment variables for tests
process.env.DYNAMODB_TABLE = 'test-payment-links';
process.env.MX_MERCHANT_API_URL = 'https://sandbox.api.mxmerchant.com/checkout/v3';
process.env.MX_MERCHANT_CONSUMER_KEY = 'test-key';
process.env.MX_MERCHANT_CONSUMER_SECRET = 'test-secret';
process.env.MX_MERCHANT_MERCHANT_ID = 'test-merchant-id';
process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.STAGE = 'test';
