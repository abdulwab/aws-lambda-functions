/**
 * MX Merchant API service for creating and managing payment links
 * Uses Link2Pay hosted payment pages
 */

const axios = require('axios');
const Logger = require('../utils/logger');

class MXMerchantService {
  constructor() {
    this.apiUrl = process.env.MX_MERCHANT_API_URL;
    this.merchantId = process.env.MX_MERCHANT_MERCHANT_ID;
    this.paymentPageBaseURL = process.env.MX_PAYMENT_PAGE_URL || 'https://sandbox-app.mxmerchant.com';
    this.logger = new Logger({ service: 'MXMerchantService' });
    this.link2PayDeviceUDID = null; // Cache for device UDID

    // Support two authentication methods:
    // 1. Consumer Key/Secret (Production)
    // 2. Username/Password (Sandbox)
    const consumerKey = process.env.MX_MERCHANT_CONSUMER_KEY;
    const consumerSecret = process.env.MX_MERCHANT_CONSUMER_SECRET;
    const username = process.env.MX_USERNAME;
    const password = process.env.MX_PASSWORD;

    let auth;
    if (consumerKey && consumerSecret) {
      // Use Consumer Key/Secret authentication
      auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      this.logger.info('Using Consumer Key/Secret authentication');
    } else if (username && password) {
      // Use Username/Password authentication
      auth = Buffer.from(`${username}:${password}`).toString('base64');
      this.logger.info('Using Username/Password authentication');
    } else {
      throw new Error('MX Merchant credentials not configured. Need either Consumer Key/Secret or Username/Password');
    }

    if (!this.apiUrl || !this.merchantId) {
      throw new Error('MX Merchant API URL and Merchant ID are required');
    }

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

    // Check for fixed UDID from environment
    const fixedUDID = process.env.MX_LINK2PAY_DEVICE_UDID;
    if (fixedUDID) {
      this.link2PayDeviceUDID = fixedUDID;
      this.logger.info('Using fixed Link2Pay device UDID from environment', { udid: fixedUDID });
      return fixedUDID;
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
   * Create a new invoice using MX Invoice API
   * @param {Object} paymentData - Payment/Invoice creation data
   * @returns {Promise<Object>} - Invoice response with payment link
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

      this.logger.info('Creating MX Invoice', {
        invoiceNumber: invoice.number,
        amount,
        customerEmail: customer.email
      });

      // Build purchases array from lineItems or create default
      const purchases = lineItems && lineItems.length > 0 
        ? lineItems.map(item => ({
            id: -1,
            productName: item.description || 'Service',
            price: parseFloat(item.unitPrice || item.totalPrice || amount),
            quantity: item.quantity || 1,
            discount: 0,
            totalAmount: parseFloat(item.totalPrice || (item.unitPrice * (item.quantity || 1))).toFixed(2),
            taxCategory: {
              name: 'No Tax',
              code: 'No Tax',
              id: -1,
              taxRate: 0
            }
          }))
        : [{
            id: -1,
            productName: invoice.description || 'Payment',
            price: parseFloat(amount),
            quantity: 1,
            discount: 0,
            totalAmount: parseFloat(amount).toFixed(2),
            taxCategory: {
              name: 'No Tax',
              code: 'No Tax',
              id: -1,
              taxRate: 0
            }
          }];

      // Create invoice
      const invoiceData = {
        merchantId: parseInt(this.merchantId),
        status: 'Unpaid',
        isClick2PayEnabled: true,
        allowCreditCard: true,
        allowACH: false,
        terms: 'OnReceipt',
        purchases,
        customer: {
          name: customer.name,
          email: customer.email,
          mobile: customer.phone || ''
        }
      };

      const response = await this.client.post('/invoice?echo=true', invoiceData);
      
      const invoiceId = response.data.id;
      const invoiceNumber = response.data.invoiceNumber;
      const accessCode = response.data.accessCode;

      // Construct payment URL with access code
      const checkoutUrl = `${this.paymentPageBaseURL}/checkout/invoice/${invoiceId}?code=${accessCode}`;

      this.logger.info('Invoice created successfully', {
        invoiceId,
        invoiceNumber,
        accessCode,
        checkoutUrl
      });

      return {
        success: true,
        paymentLinkId: `invoice_${invoiceId}`,
        mxInvoiceId: invoiceId,
        mxInvoiceNumber: invoiceNumber,
        accessCode,
        checkoutUrl,
        status: 'created',
        invoiceData: response.data
      };

    } catch (error) {
      this.logger.error('Failed to create invoice', {
        error: error.message,
        response: error.response?.data,
        invoiceNumber: paymentData.invoice?.number
      });

      throw new Error(`Invoice creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send invoice receipt to customer
   * @param {number} invoiceId - Invoice ID
   * @param {string} email - Customer email
   * @param {string} phone - Customer phone (optional)
   * @returns {Promise<Object>} - Receipt send response
   */
  async sendInvoiceReceipt(invoiceId, email, phone = null) {
    try {
      this.logger.info('Sending invoice receipt', { invoiceId, email, phone });

      const contacts = phone ? `${email},${encodeURIComponent(phone)}` : email;
      const url = `/invoicereceipt?id=${invoiceId}&contact=${contacts}`;

      await this.client.post(url);

      this.logger.info('Invoice receipt sent successfully', { invoiceId, email });

      return {
        success: true,
        invoiceId,
        sentTo: { email, phone }
      };

    } catch (error) {
      this.logger.error('Failed to send invoice receipt', {
        error: error.message,
        response: error.response?.data,
        invoiceId
      });

      throw new Error(`Invoice receipt send failed: ${error.response?.data?.message || error.message}`);
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
