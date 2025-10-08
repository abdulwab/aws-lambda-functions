/**
 * Twilio SMS service for sending payment link notifications
 */

const twilio = require('twilio');
const Logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.logger = new Logger({ service: 'TwilioService' });

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(this.accountSid, this.authToken);
  }

  /**
   * Send payment link via SMS
   * @param {string} to - Recipient phone number
   * @param {string} paymentLink - The checkout URL
   * @param {Object} invoiceData - Invoice information
   * @returns {Promise<Object>} - Twilio message response
   */
  async sendPaymentLinkSMS(to, paymentLink, invoiceData) {
    try {
      const { invoiceNumber, customerName, amount } = invoiceData;
      
      const message = `Hi ${customerName}, your payment link for invoice ${invoiceNumber} ($${amount}) is ready. Click here to pay: ${paymentLink}`;

      this.logger.info('Sending payment link SMS', {
        to,
        invoiceNumber,
        amount
      });

      const messageResponse = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      this.logger.info('SMS sent successfully', {
        messageSid: messageResponse.sid,
        to,
        status: messageResponse.status
      });

      return {
        success: true,
        messageSid: messageResponse.sid,
        status: messageResponse.status
      };

    } catch (error) {
      this.logger.error('Failed to send SMS', {
        error: error.message,
        to,
        invoiceNumber: invoiceData.invoiceNumber
      });

      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  /**
   * Send payment confirmation SMS
   * @param {string} to - Recipient phone number
   * @param {Object} paymentData - Payment confirmation data
   * @returns {Promise<Object>} - Twilio message response
   */
  async sendPaymentConfirmationSMS(to, paymentData) {
    try {
      const { invoiceNumber, amount, transactionId } = paymentData;
      
      const message = `Payment confirmed! Invoice ${invoiceNumber} for $${amount} has been processed successfully. Transaction ID: ${transactionId}`;

      this.logger.info('Sending payment confirmation SMS', {
        to,
        invoiceNumber,
        amount,
        transactionId
      });

      const messageResponse = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      this.logger.info('Payment confirmation SMS sent', {
        messageSid: messageResponse.sid,
        to,
        status: messageResponse.status
      });

      return {
        success: true,
        messageSid: messageResponse.sid,
        status: messageResponse.status
      };

    } catch (error) {
      this.logger.error('Failed to send payment confirmation SMS', {
        error: error.message,
        to,
        invoiceNumber: paymentData.invoiceNumber
      });

      throw new Error(`Payment confirmation SMS failed: ${error.message}`);
    }
  }

  /**
   * Send payment failure notification SMS
   * @param {string} to - Recipient phone number
   * @param {Object} paymentData - Payment failure data
   * @returns {Promise<Object>} - Twilio message response
   */
  async sendPaymentFailureSMS(to, paymentData) {
    try {
      const { invoiceNumber, amount, reason } = paymentData;
      
      const message = `Payment failed for invoice ${invoiceNumber} ($${amount}). Reason: ${reason}. Please try again or contact us for assistance.`;

      this.logger.info('Sending payment failure SMS', {
        to,
        invoiceNumber,
        amount,
        reason
      });

      const messageResponse = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      this.logger.info('Payment failure SMS sent', {
        messageSid: messageResponse.sid,
        to,
        status: messageResponse.status
      });

      return {
        success: true,
        messageSid: messageResponse.sid,
        status: messageResponse.status
      };

    } catch (error) {
      this.logger.error('Failed to send payment failure SMS', {
        error: error.message,
        to,
        invoiceNumber: paymentData.invoiceNumber
      });

      throw new Error(`Payment failure SMS failed: ${error.message}`);
    }
  }
}

module.exports = TwilioService;
