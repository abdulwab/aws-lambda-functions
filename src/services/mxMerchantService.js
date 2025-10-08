/**
 * MX Merchant API service for creating and managing payment links
 * Uses Link2Pay hosted payment pages
 */

const axios = require('axios');
const Logger = require('../utils/logger');

class MXMerchantService {
  constructor() {
    this.apiUrl = process.env.MX_MERCHANT_API_URL;
    this.apiKey = process.env.MX_MERCHANT_CONSUMER_KEY;
    this.apiSecret = process.env.MX_MERCHANT_CONSUMER_SECRET;
    this.merchantId = process.env.MX_MERCHANT_MERCHANT_ID;
    this.paymentPageBaseURL = process.env.MX_PAYMENT_PAGE_URL || 'https://mxmerchant.com';
    this.logger = new Logger({ service: 'MXMerchantService' });
    this.link2PayDeviceUDID = null; // Cache for device UDID

    if (!this.apiUrl || !this.apiKey || !this.apiSecret || !this.merchantId) {
      throw new Error('MX Merchant credentials not configured');
    }

    // Create Basic Auth token
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

    // Create axios instance with Basic Auth
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      timeout: 30000
    });
  }

  /**
   * Get or create Link2Pay device for hosted payment pages
   * @returns {Promise<string>} Device UDID
   */
  async getLink2PayDevice() {
    // Return cached UDID if available
    if (this.link2PayDeviceUDID) {
      return this.link2PayDeviceUDID;
    }

    try {
      // Try to get existing Link2Pay devices
      const listResponse = await this.client.get('/device', {
        params: {
          merchantId: this.merchantId,
          deviceType: 'Link2Pay'
        }
      });

      // Use first enabled Link2Pay device
      if (listResponse.data && listResponse.data.length > 0) {
        const existingDevice = listResponse.data.find(
          device => device.enabled && device.deviceType === 'Link2Pay'
        );
        
        if (existingDevice) {
          this.link2PayDeviceUDID = existingDevice.UDID;
          this.logger.info('Using existing Link2Pay device', { udid: this.link2PayDeviceUDID });
          return this.link2PayDeviceUDID;
        }
      }

      // Create new Link2Pay device if none exists
      const timestamp = Date.now();
      const deviceData = {
        name: `Payment Link API ${timestamp}`,
        description: 'Hosted payment page for API',
        deviceType: 'Link2Pay',
        merchantId: parseInt(this.merchantId),
        enabled: true,
        onSuccessUrl: 'https://celebrationchevrolet.com/payment/success',
        onFailureUrl: 'https://celebrationchevrolet.com/payment/cancel'
      };

      const response = await this.client.post('/device?echo=true', deviceData);
      this.link2PayDeviceUDID = response.data.UDID;
      this.logger.info('Created new Link2Pay device', { udid: this.link2PayDeviceUDID });
      return this.link2PayDeviceUDID;

    } catch (error) {
      this.logger.error('Failed to get/create Link2Pay device', {
        error: error.message,
        response: error.response?.data
      });
      throw new Error(`Link2Pay device error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a new payment link using Link2Pay hosted page
   * @param {Object} paymentData - Payment link creation data
   * @returns {Promise<Object>} - Payment link response with hosted URL
   */
  async createPaymentLink(paymentData) {
    try {
      const {
        amount,
        currency = 'USD',
        invoice,
        customer,
        lineItems = []
      } = paymentData;

      this.logger.info('Creating Link2Pay payment URL', {
        invoiceNumber: invoice.number,
        amount,
        customerEmail: customer.email
      });

      // Get or create Link2Pay device
      const udid = await this.getLink2PayDevice();

      // Build query parameters for hosted payment page
      const params = new URLSearchParams({
        Amt: parseFloat(amount).toFixed(2),
        InvoiceNo: invoice.number,
        CustomerName: customer.name,
        CustomerEmail: customer.email
      });

      // Add optional phone
      if (customer.phone) {
        params.append('CustomerPhone', customer.phone);
      }

      // Add description/memo
      if (invoice.description) {
        params.append('Memo', invoice.description);
      }

      // Add line items if provided
      if (lineItems && lineItems.length > 0) {
        lineItems.forEach((item, index) => {
          if (item.description) {
            params.append(`Item${index + 1}Description`, item.description);
          }
          if (item.unitPrice || item.totalPrice) {
            const itemAmount = item.totalPrice || (item.unitPrice * (item.quantity || 1));
            params.append(`Item${index + 1}Amount`, parseFloat(itemAmount).toFixed(2));
          }
          if (item.quantity) {
            params.append(`Item${index + 1}Quantity`, item.quantity);
          }
        });
      }

      // Construct the hosted payment URL
      const checkoutUrl = `${this.paymentPageBaseURL}/Link2Pay/${udid}?${params.toString()}`;

      this.logger.info('Payment link created successfully', {
        udid,
        checkoutUrl,
        invoiceNumber: invoice.number
      });

      return {
        success: true,
        paymentLinkId: `link2pay_${Date.now()}`, // Generate unique ID
        mxPaymentLinkId: udid, // Store device UDID
        checkoutUrl,
        status: 'created'
      };

    } catch (error) {
      this.logger.error('Failed to create payment link', {
        error: error.message,
        response: error.response?.data,
        invoiceNumber: paymentData.invoice?.number
      });

      throw new Error(`Payment link creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Retrieve payment link status
   * @param {string} paymentLinkId - Payment link ID
   * @returns {Promise<Object>} - Payment link status
   */
  async getPaymentLinkStatus(paymentLinkId) {
    try {
      this.logger.info('Retrieving payment link status', { paymentLinkId });

      const response = await this.client.get(`/paymentLinks/${paymentLinkId}`);

      this.logger.info('Payment link status retrieved', {
        paymentLinkId,
        status: response.data.status
      });

      return {
        success: true,
        paymentLinkId: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
        transactionId: response.data.transactionId
      };

    } catch (error) {
      this.logger.error('Failed to retrieve payment link status', {
        error: error.message,
        response: error.response?.data,
        paymentLinkId
      });

      throw new Error(`Failed to retrieve payment link status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Validate webhook signature (if MX Merchant provides webhook signing)
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} - Whether signature is valid
   */
  validateWebhookSignature(payload, signature) {
    // Note: MX Merchant may not provide webhook signing
    // Check and update this is a placeholder for future implementation
    this.logger.warn('Webhook signature validation not implemented', {
      hasSignature: !!signature
    });
    
    return true; // For now, accept all webhooks
  }

  /**
   * Process webhook notification
   * @param {Object} webhookData - Webhook payload
   * @returns {Object} - Processed webhook data
   */
  processWebhook(webhookData) {
    try {
      this.logger.info('Processing webhook', {
        eventType: webhookData.eventType,
        paymentLinkId: webhookData.paymentLinkId
      });

      const processedData = {
        paymentLinkId: webhookData.paymentLinkId,
        eventType: webhookData.eventType,
        status: webhookData.status,
        amount: webhookData.amount,
        currency: webhookData.currency,
        transactionId: webhookData.transactionId,
        timestamp: webhookData.timestamp || new Date().toISOString(),
        metadata: webhookData.metadata || {}
      };

      this.logger.info('Webhook processed successfully', processedData);

      return processedData;

    } catch (error) {
      this.logger.error('Failed to process webhook', {
        error: error.message,
        webhookData
      });

      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }
}

module.exports = MXMerchantService;
