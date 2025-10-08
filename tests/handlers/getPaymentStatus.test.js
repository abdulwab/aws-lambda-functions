/**
 * Tests for getPaymentStatus Lambda handler
 */

const { handler } = require('../../src/handlers/getPaymentStatus');
const DynamoService = require('../../src/services/dynamoService');
const MXMerchantService = require('../../src/services/mxMerchantService');

// Mock the services
jest.mock('../../src/services/dynamoService');
jest.mock('../../src/services/mxMerchantService');

describe('getPaymentStatus handler', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    mockEvent = {
      httpMethod: 'GET',
      path: '/payment-links/uuid-123',
      pathParameters: {
        id: 'uuid-123'
      }
    };

    mockContext = {
      awsRequestId: 'test-request-id'
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  test('should get payment status successfully', async () => {
    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      checkoutUrl: 'https://sandbox.mxmerchant.com/checkout/pl_12345abc',
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
      },
      lineItems: [
        {
          description: 'Brake Pad Replacement',
          quantity: 1,
          unitPrice: 150.00,
          totalPrice: 150.00
        }
      ],
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    const mockMXStatus = {
      success: true,
      paymentLinkId: 'pl_12345abc',
      status: 'created',
      amount: 487.50,
      currency: 'USD',
      transactionId: null,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    DynamoService.prototype.getPaymentLink.mockResolvedValue(mockPaymentLink);
    MXMerchantService.prototype.getPaymentLinkStatus.mockResolvedValue(mockMXStatus);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.paymentLinkId).toBe('uuid-123');
    expect(JSON.parse(result.body).data.status).toBe('created');
    expect(JSON.parse(result.body).data.amount).toBe(487.50);
    expect(JSON.parse(result.body).data.mxMerchantStatus).toBeDefined();
  });

  test('should handle payment link not found', async () => {
    DynamoService.prototype.getPaymentLink.mockResolvedValue(null);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Payment link not found');
  });

  test('should handle missing payment link ID', async () => {
    mockEvent.pathParameters = {};

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(JSON.parse(result.body).error.message).toContain('Payment link ID is required');
  });

  test('should update status when MX Merchant status differs', async () => {
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
      },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    const mockMXStatus = {
      success: true,
      paymentLinkId: 'pl_12345abc',
      status: 'completed',
      amount: 487.50,
      currency: 'USD',
      transactionId: 'txn_12345',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    const mockUpdatedRecord = {
      paymentLinkId: 'uuid-123',
      status: 'completed',
      transactionId: 'txn_12345',
      lastSyncAt: '2024-01-15T10:45:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    DynamoService.prototype.getPaymentLink.mockResolvedValue(mockPaymentLink);
    MXMerchantService.prototype.getPaymentLinkStatus.mockResolvedValue(mockMXStatus);
    DynamoService.prototype.updatePaymentLinkStatus.mockResolvedValue(mockUpdatedRecord);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('completed');
    expect(JSON.parse(result.body).data.transactionId).toBe('txn_12345');
    expect(JSON.parse(result.body).data.lastSyncAt).toBeDefined();
  });

  test('should handle MX Merchant service failure gracefully', async () => {
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
      },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    };

    DynamoService.prototype.getPaymentLink.mockResolvedValue(mockPaymentLink);
    MXMerchantService.prototype.getPaymentLinkStatus.mockRejectedValue(
      new Error('MX Merchant API error')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('created');
    expect(JSON.parse(result.body).data.mxMerchantStatus).toBeNull();
  });

  test('should include status-specific fields for completed payments', async () => {
    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'completed',
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
      },
      transactionId: 'txn_12345',
      completedAt: '2024-01-15T10:45:00Z',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    DynamoService.prototype.getPaymentLink.mockResolvedValue(mockPaymentLink);
    MXMerchantService.prototype.getPaymentLinkStatus.mockResolvedValue({
      success: true,
      status: 'completed',
      transactionId: 'txn_12345'
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('completed');
    expect(JSON.parse(result.body).data.completedAt).toBe('2024-01-15T10:45:00Z');
    expect(JSON.parse(result.body).data.transactionId).toBe('txn_12345');
  });

  test('should include status-specific fields for failed payments', async () => {
    const mockPaymentLink = {
      paymentLinkId: 'uuid-123',
      mxPaymentLinkId: 'pl_12345abc',
      status: 'failed',
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
      },
      failedAt: '2024-01-15T10:45:00Z',
      failureReason: 'Insufficient funds',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:45:00Z'
    };

    DynamoService.prototype.getPaymentLink.mockResolvedValue(mockPaymentLink);
    MXMerchantService.prototype.getPaymentLinkStatus.mockResolvedValue({
      success: true,
      status: 'failed'
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.status).toBe('failed');
    expect(JSON.parse(result.body).data.failedAt).toBe('2024-01-15T10:45:00Z');
    expect(JSON.parse(result.body).data.failureReason).toBe('Insufficient funds');
  });
});
