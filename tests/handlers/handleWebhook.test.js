/**
 * Tests for handleWebhook Lambda handler
 */

const { handler } = require('../../src/handlers/handleWebhook');
const MXMerchantService = require('../../src/services/mxMerchantService');
const DynamoService = require('../../src/services/dynamoService');
const TwilioService = require('../../src/services/twilioService');

// Mock the services
jest.mock('../../src/services/mxMerchantService');
jest.mock('../../src/services/dynamoService');
jest.mock('../../src/services/twilioService');

describe('handleWebhook handler', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    mockEvent = {
      httpMethod: 'POST',
      path: '/webhook',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentLinkId: 'pl_12345abc',
        eventType: 'payment.completed',
        status: 'completed',
        amount: 487.50,
        currency: 'USD',
        transactionId: 'txn_12345',
        timestamp: '2024-01-15T10:45:00Z'
      })
    };

    mockContext = {
      awsRequestId: 'test-request-id'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  test('should process payment completed webhook successfully', async () => {
    // Mock processed webhook data
    const mockProcessedWebhook = {
      paymentLinkId: 'pl_12345abc',
      eventType: 'payment.completed',
      status: 'completed',
      amount: 487.50,
      currency: 'USD',
      transactionId: 'txn_12345',
      timestamp: '2024-01-15T10:45:00Z'
    };

    // Mock payment link from database
    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: {
        number: 'RO-252656',
        description: 'Brake Service Complete'
      },
      customer: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+15551234567'
      }
    };

    // Mock updated record
    const mockUpdatedRecord = {
      paymentLinkId: 'uuid-123',
      status: 'completed',
      transactionId: 'txn_12345',
      completedAt: '2024-01-15T10:45:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    // Mock SMS response
    const mockSMSResponse = {
      success: true,
      messageSid: 'SM1234567890',
      status: 'sent'
    };

    MXMerchantService.prototype.processWebhook.mockReturnValue(mockProcessedWebhook);
    DynamoService.prototype.getPaymentLinksByStatus.mockResolvedValue([mockPaymentLink]);
    DynamoService.prototype.updatePaymentLinkStatus.mockResolvedValue(mockUpdatedRecord);
    TwilioService.prototype.sendPaymentConfirmationSMS.mockResolvedValue(mockSMSResponse);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('completed');
    expect(JSON.parse(result.body).data.eventType).toBe('payment.completed');
    expect(JSON.parse(result.body).data.smsNotification.sent).toBe(true);
  });

  test('should process payment failed webhook successfully', async () => {
    mockEvent.body = JSON.stringify({
      paymentLinkId: 'pl_12345abc',
      eventType: 'payment.failed',
      status: 'failed',
      amount: 487.50,
      currency: 'USD',
      transactionId: 'txn_12345',
      timestamp: '2024-01-15T10:45:00Z',
      metadata: {
        reason: 'Insufficient funds'
      }
    });

    const mockProcessedWebhook = {
      paymentLinkId: 'pl_12345abc',
      eventType: 'payment.failed',
      status: 'failed',
      amount: 487.50,
      currency: 'USD',
      transactionId: 'txn_12345',
      timestamp: '2024-01-15T10:45:00Z',
      metadata: {
        reason: 'Insufficient funds'
      }
    };

    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: {
        number: 'RO-252656',
        description: 'Brake Service Complete'
      },
      customer: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+15551234567'
      }
    };

    const mockUpdatedRecord = {
      paymentLinkId: 'uuid-123',
      status: 'failed',
      transactionId: 'txn_12345',
      failedAt: '2024-01-15T10:45:00Z',
      failureReason: 'Insufficient funds',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    const mockSMSResponse = {
      success: true,
      messageSid: 'SM1234567890',
      status: 'sent'
    };

    MXMerchantService.prototype.processWebhook.mockReturnValue(mockProcessedWebhook);
    DynamoService.prototype.getPaymentLinksByStatus.mockResolvedValue([mockPaymentLink]);
    DynamoService.prototype.updatePaymentLinkStatus.mockResolvedValue(mockUpdatedRecord);
    TwilioService.prototype.sendPaymentFailureSMS.mockResolvedValue(mockSMSResponse);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('failed');
    expect(JSON.parse(result.body).data.eventType).toBe('payment.failed');
    expect(JSON.parse(result.body).data.smsNotification.sent).toBe(true);
  });

  test('should handle payment link not found', async () => {
    const mockProcessedWebhook = {
      paymentLinkId: 'pl_nonexistent',
      eventType: 'payment.completed',
      status: 'completed'
    };

    MXMerchantService.prototype.processWebhook.mockReturnValue(mockProcessedWebhook);
    DynamoService.prototype.getPaymentLinksByStatus.mockResolvedValue([]);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Payment link not found');
  });

  test('should handle invalid webhook payload', async () => {
    mockEvent.body = JSON.stringify({
      // Missing paymentLinkId and eventType
      amount: 487.50
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Invalid webhook payload');
  });

  test('should handle unknown event type', async () => {
    mockEvent.body = JSON.stringify({
      paymentLinkId: 'pl_12345abc',
      eventType: 'unknown.event',
      status: 'unknown'
    });

    const mockProcessedWebhook = {
      paymentLinkId: 'pl_12345abc',
      eventType: 'unknown.event',
      status: 'unknown'
    };

    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: {
        number: 'RO-252656',
        description: 'Brake Service Complete'
      },
      customer: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+15551234567'
      }
    };

    const mockUpdatedRecord = {
      paymentLinkId: 'uuid-123',
      status: 'unknown',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    MXMerchantService.prototype.processWebhook.mockReturnValue(mockProcessedWebhook);
    DynamoService.prototype.getPaymentLinksByStatus.mockResolvedValue([mockPaymentLink]);
    DynamoService.prototype.updatePaymentLinkStatus.mockResolvedValue(mockUpdatedRecord);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('unknown');
  });

  test('should handle SMS failure gracefully', async () => {
    const mockProcessedWebhook = {
      paymentLinkId: 'pl_12345abc',
      eventType: 'payment.completed',
      status: 'completed',
      amount: 487.50,
      currency: 'USD',
      transactionId: 'txn_12345',
      timestamp: '2024-01-15T10:45:00Z'
    };

    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      invoice: {
        number: 'RO-252656',
        description: 'Brake Service Complete'
      },
      customer: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+15551234567'
      }
    };

    const mockUpdatedRecord = {
      paymentLinkId: 'uuid-123',
      status: 'completed',
      transactionId: 'txn_12345',
      completedAt: '2024-01-15T10:45:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    MXMerchantService.prototype.processWebhook.mockReturnValue(mockProcessedWebhook);
    DynamoService.prototype.getPaymentLinksByStatus.mockResolvedValue([mockPaymentLink]);
    DynamoService.prototype.updatePaymentLinkStatus.mockResolvedValue(mockUpdatedRecord);
    TwilioService.prototype.sendPaymentConfirmationSMS.mockRejectedValue(
      new Error('SMS sending failed')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.smsNotification.sent).toBe(false);
    expect(JSON.parse(result.body).data.smsNotification.reason).toContain('SMS sending failed');
  });
});
