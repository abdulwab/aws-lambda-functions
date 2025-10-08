/**
 * MX Merchant API service for creating and managing payment links
 */

const axios = require('axios');
const Logger = require('../utils/logger');

class MXMerchantService {
  constructor() {
    this.apiUrl = process.env.MX_MERCHANT_API_URL;
    this.consumerKey = process.env.MX_MERCHANT_CONSUMER_KEY;
    this.consumerSecret = process.env.MX_MERCHANT_CONSUMER_SECRET;
    this.merchantId = process.env.MX_MERCHANT_MERCHANT_ID;
    this.logger = new Logger({ service: 'MXMerchantService' });

    if (!this.apiUrl || !this.consumerKey || !this.consumerSecret || !this.merchantId) {
      throw new Error('MX Merchant credentials not configured');
    }

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.consumerKey}`,
        'X-Merchant-ID': this.merchantId
      },
      timeout: 30000
    });
  }

  /**
   * Create a new payment link
   * @param {Object} paymentData - Payment link creation data
   * @returns {Promise<Object>} - Payment link response
   */
  async createPaymentLink(paymentData) {
    try {
      const {
        amount,
        currency = 'USD',
        invoice,
        customer,
        redirectUrl,
        cancelUrl,
        lineItems = []
      } = paymentData;

      const requestBody = {
        amount: parseFloat(amount),
        currency,
        invoice: {
          number: invoice.number,
          description: invoice.description || `Payment for ${invoice.number}`
        },
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        },
        redirectUrl,
        cancelUrl,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: parseFloat(item.totalPrice)
        }))
      };

      this.logger.info('Creating payment link', {
        invoiceNumber: invoice.number,
        amount,
        customerEmail: customer.email
      });

      const response = await this.client.post('/paymentLinks', requestBody);

      this.logger.info('Payment link created successfully', {
        paymentLinkId: response.data.id,
        checkoutUrl: response.data.checkoutUrl,
        invoiceNumber: invoice.number
      });

      return {
        success: true,
        paymentLinkId: response.data.id,
        checkoutUrl: response.data.checkoutUrl,
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
