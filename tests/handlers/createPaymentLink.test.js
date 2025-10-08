/**
 * Tests for createPaymentLink Lambda handler
 */

const { handler } = require('../../src/handlers/createPaymentLink');
const MXMerchantService = require('../../src/services/mxMerchantService');
const DynamoService = require('../../src/services/dynamoService');
const TwilioService = require('../../src/services/twilioService');

// Mock the services
jest.mock('../../src/services/mxMerchantService');
jest.mock('../../src/services/dynamoService');
jest.mock('../../src/services/twilioService');

describe('createPaymentLink handler', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    mockEvent = {
      httpMethod: 'POST',
      path: '/payment-links',
      body: JSON.stringify({
        amount: 487.50,
        currency: 'USD',
        invoice: {
          number: 'RO-252656',
          description: 'Brake Service Complete - 2019 Silverado 1500'
        },
        customer: {
          name: 'Sarah Johnson',
          email: 'sarah.johnson@email.com',
          phone: '+15551234567'
        },
        lineItems: [
          {
            description: 'Brake Pad Replacement',
            quantity: 1,
            unitPrice: 150.00,
            totalPrice: 150.00
          }
        ],
        sendSMS: true
      })
    };

    mockContext = {
      awsRequestId: 'test-request-id'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  test('should create payment link successfully', async () => {
    // Mock MX Merchant service response
    const mockMXResponse = {
      success: true,
      paymentLinkId: 'pl_12345abc',
      checkoutUrl: 'https://sandbox.mxmerchant.com/checkout/pl_12345abc',
      status: 'created'
    };

    // Mock DynamoDB service response
    const mockDBRecord = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      checkoutUrl: 'https://sandbox.mxmerchant.com/checkout/pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: mockEvent.invoice,
      customer: mockEvent.customer,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    // Mock Twilio service response
    const mockSMSResponse = {
      success: true,
      messageSid: 'SM1234567890',
      status: 'sent'
    };

    MXMerchantService.prototype.createPaymentLink.mockResolvedValue(mockMXResponse);
    DynamoService.prototype.createPaymentLink.mockResolvedValue(mockDBRecord);
    TwilioService.prototype.sendPaymentLinkSMS.mockResolvedValue(mockSMSResponse);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.paymentLinkId).toBe('uuid-123');
    expect(JSON.parse(result.body).data.checkoutUrl).toBe('https://sandbox.mxmerchant.com/checkout/pl_12345abc');
    expect(JSON.parse(result.body).data.smsNotification.sent).toBe(true);
  });

  test('should handle missing required fields', async () => {
    mockEvent.body = JSON.stringify({
      amount: 487.50
      // Missing invoice and customer
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Missing required fields');
  });

  test('should handle invalid amount', async () => {
    mockEvent.body = JSON.stringify({
      amount: 'invalid',
      invoice: { number: 'RO-123' },
      customer: { name: 'Test', email: 'test@test.com' }
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Valid amount is required');
  });

  test('should handle MX Merchant service failure', async () => {
    MXMerchantService.prototype.createPaymentLink.mockRejectedValue(
      new Error('MX Merchant API error')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Failed to create payment link');
  });

  test('should handle SMS failure gracefully', async () => {
    const mockMXResponse = {
      success: true,
      paymentLinkId: 'pl_12345abc',
      checkoutUrl: 'https://sandbox.mxmerchant.com/checkout/pl_12345abc',
      status: 'created'
    };

    const mockDBRecord = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      checkoutUrl: 'https://sandbox.mxmerchant.com/checkout/pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: mockEvent.invoice,
      customer: mockEvent.customer,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    MXMerchantService.prototype.createPaymentLink.mockResolvedValue(mockMXResponse);
    DynamoService.prototype.createPaymentLink.mockResolvedValue(mockDBRecord);
    TwilioService.prototype.sendPaymentLinkSMS.mockRejectedValue(
      new Error('SMS sending failed')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.smsNotification.sent).toBe(false);
    expect(JSON.parse(result.body).data.smsNotification.reason).toContain('SMS sending failed');
  });

  test('should handle invalid JSON in request body', async () => {
    mockEvent.body = 'invalid json';

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Invalid JSON in request body');
  });
});
