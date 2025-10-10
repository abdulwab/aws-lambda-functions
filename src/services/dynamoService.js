/**
 * DynamoDB service for managing payment link records
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Logger = require('../utils/logger');

class DynamoService {
  constructor() {
    this.dynamodb = new AWS.DynamoDB.DocumentClient();
    this.tableName = process.env.DYNAMODB_TABLE;
    this.logger = new Logger({ service: 'DynamoService' });

    if (!this.tableName) {
      throw new Error('DynamoDB table name not configured');
    }
  }

  /**
   * Create a new payment link record
   * @param {Object} paymentLinkData - Payment link data
   * @returns {Promise<Object>} - Created record
   */
  async createPaymentLink(paymentLinkData) {
    try {
      const paymentLinkId = uuidv4();
      const now = new Date().toISOString();

      const record = {
        paymentLinkId,
        mxPaymentLinkId: paymentLinkData.mxPaymentLinkId,
        mxInvoiceId: paymentLinkData.mxInvoiceId,
        mxInvoiceNumber: paymentLinkData.mxInvoiceNumber,
        checkoutUrl: paymentLinkData.checkoutUrl,
        status: 'created',
        amount: paymentLinkData.amount,
        currency: paymentLinkData.currency || 'USD',
        invoice: paymentLinkData.invoice,
        customer: paymentLinkData.customer,
        lineItems: paymentLinkData.lineItems || [],
        smsStatus: 'pending', // SMS notification status
        emailStatus: 'pending', // Email notification status
        eventHistory: [{
          eventType: 'created',
          status: 'created',
          timestamp: now,
          source: 'system',
          description: 'Payment link created'
        }], // Event history for tracking all status changes
        createdAt: now,
        updatedAt: now,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
      };

      this.logger.info('Creating payment link record', {
        paymentLinkId,
        invoiceNumber: paymentLinkData.invoice?.number
      });

      await this.dynamodb.put({
        TableName: this.tableName,
        Item: record
      }).promise();

      this.logger.info('Payment link record created', {
        paymentLinkId,
        status: record.status
      });

      return record;

    } catch (error) {
      this.logger.error('Failed to create payment link record', {
        error: error.message,
        invoiceNumber: paymentLinkData.invoice?.number
      });

      throw new Error(`Failed to create payment link record: ${error.message}`);
    }
  }

  /**
   * Get payment link by ID
   * @param {string} paymentLinkId - Payment link ID
   * @returns {Promise<Object|null>} - Payment link record
   */
  async getPaymentLink(paymentLinkId) {
    try {
      this.logger.info('Retrieving payment link', { paymentLinkId });

      const result = await this.dynamodb.get({
        TableName: this.tableName,
        Key: { paymentLinkId }
      }).promise();

      if (!result.Item) {
        this.logger.warn('Payment link not found', { paymentLinkId });
        return null;
      }

      this.logger.info('Payment link retrieved', {
        paymentLinkId,
        status: result.Item.status
      });

      return result.Item;

    } catch (error) {
      this.logger.error('Failed to retrieve payment link', {
        error: error.message,
        paymentLinkId
      });

      throw new Error(`Failed to retrieve payment link: ${error.message}`);
    }
  }

  /**
   * Update payment link status
   * @param {string} paymentLinkId - Payment link ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} - Updated record
   */
  async updatePaymentLinkStatus(paymentLinkId, status, additionalData = {}) {
    try {
      const now = new Date().toISOString();

      const updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
      const expressionAttributeNames = { '#status': 'status' };
      const expressionAttributeValues = {
        ':status': status,
        ':updatedAt': now
      };

      // Add additional fields to update
      Object.keys(additionalData).forEach(key => {
        if (additionalData[key] !== undefined) {
          updateExpression += `, ${key} = :${key}`;
          expressionAttributeValues[`:${key}`] = additionalData[key];
        }
      });

      this.logger.info('Updating payment link status', {
        paymentLinkId,
        status,
        additionalFields: Object.keys(additionalData)
      });

      const result = await this.dynamodb.update({
        TableName: this.tableName,
        Key: { paymentLinkId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }).promise();

      this.logger.info('Payment link status updated', {
        paymentLinkId,
        newStatus: status
      });

      return result.Attributes;

    } catch (error) {
      this.logger.error('Failed to update payment link status', {
        error: error.message,
        paymentLinkId,
        status
      });

      throw new Error(`Failed to update payment link status: ${error.message}`);
    }
  }

  /**
   * Get payment links by status
   * @param {string} status - Payment link status
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} - Array of payment link records
   */
  async getPaymentLinksByStatus(status, limit = 100) {
    try {
      this.logger.info('Querying payment links by status', { status, limit });

      const result = await this.dynamodb.scan({
        TableName: this.tableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        Limit: limit
      }).promise();

      this.logger.info('Payment links retrieved by status', {
        status,
        count: result.Items.length
      });

      return result.Items;

    } catch (error) {
      this.logger.error('Failed to query payment links by status', {
        error: error.message,
        status
      });

      throw new Error(`Failed to query payment links by status: ${error.message}`);
    }
  }

  /**
   * Get payment links by customer email
   * @param {string} customerEmail - Customer email
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} - Array of payment link records
   */
  async getPaymentLinksByCustomer(customerEmail, limit = 100) {
    try {
      this.logger.info('Querying payment links by customer', { customerEmail, limit });

      const result = await this.dynamodb.scan({
        TableName: this.tableName,
        FilterExpression: 'customer.email = :email',
        ExpressionAttributeValues: { ':email': customerEmail },
        Limit: limit
      }).promise();

      this.logger.info('Payment links retrieved by customer', {
        customerEmail,
        count: result.Items.length
      });

      return result.Items;

    } catch (error) {
      this.logger.error('Failed to query payment links by customer', {
        error: error.message,
        customerEmail
      });

      throw new Error(`Failed to query payment links by customer: ${error.message}`);
    }
  }

  /**
   * Add event to payment link history
   * @param {string} paymentLinkId - Payment link ID
   * @param {Object} eventData - Event data to add
   * @returns {Promise<Object>} - Updated record
   */
  async addEventToHistory(paymentLinkId, eventData) {
    try {
      const now = new Date().toISOString();
      
      const event = {
        eventType: eventData.eventType,
        status: eventData.status,
        timestamp: eventData.timestamp || now,
        source: eventData.source || 'webhook',
        description: eventData.description || `Status changed to ${eventData.status}`,
        metadata: eventData.metadata || {}
      };

      this.logger.info('Adding event to history', {
        paymentLinkId,
        eventType: event.eventType,
        status: event.status
      });

      const result = await this.dynamodb.update({
        TableName: this.tableName,
        Key: { paymentLinkId },
        UpdateExpression: 'SET eventHistory = list_append(if_not_exists(eventHistory, :empty_list), :event), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':event': [event],
          ':empty_list': [],
          ':updatedAt': now
        },
        ReturnValues: 'ALL_NEW'
      }).promise();

      this.logger.info('Event added to history', {
        paymentLinkId,
        eventType: event.eventType,
        totalEvents: result.Attributes.eventHistory?.length || 0
      });

      return result.Attributes;

    } catch (error) {
      this.logger.error('Failed to add event to history', {
        error: error.message,
        paymentLinkId,
        eventType: eventData.eventType
      });

      throw new Error(`Failed to add event to history: ${error.message}`);
    }
  }

  /**
   * Update notification status (SMS and/or Email)
   * @param {string} paymentLinkId - Payment link ID
   * @param {Object} notificationStatus - Notification status object
   * @returns {Promise<Object>} - Updated record
   */
  async updateNotificationStatus(paymentLinkId, notificationStatus) {
    try {
      const now = new Date().toISOString();
      const updateParts = ['updatedAt = :updatedAt'];
      const expressionAttributeValues = { ':updatedAt': now };

      // Add SMS status if provided
      if (notificationStatus.smsStatus) {
        updateParts.push('smsStatus = :smsStatus');
        expressionAttributeValues[':smsStatus'] = notificationStatus.smsStatus;
        
        if (notificationStatus.smsMessageSid) {
          updateParts.push('smsMessageSid = :smsMessageSid');
          expressionAttributeValues[':smsMessageSid'] = notificationStatus.smsMessageSid;
        }
        
        if (notificationStatus.smsSentAt) {
          updateParts.push('smsSentAt = :smsSentAt');
          expressionAttributeValues[':smsSentAt'] = notificationStatus.smsSentAt;
        }
      }

      // Add Email status if provided
      if (notificationStatus.emailStatus) {
        updateParts.push('emailStatus = :emailStatus');
        expressionAttributeValues[':emailStatus'] = notificationStatus.emailStatus;
        
        if (notificationStatus.emailMessageId) {
          updateParts.push('emailMessageId = :emailMessageId');
          expressionAttributeValues[':emailMessageId'] = notificationStatus.emailMessageId;
        }
        
        if (notificationStatus.emailSentAt) {
          updateParts.push('emailSentAt = :emailSentAt');
          expressionAttributeValues[':emailSentAt'] = notificationStatus.emailSentAt;
        }
      }

      const updateExpression = 'SET ' + updateParts.join(', ');

      this.logger.info('Updating notification status', {
        paymentLinkId,
        smsStatus: notificationStatus.smsStatus,
        emailStatus: notificationStatus.emailStatus
      });

      const result = await this.dynamodb.update({
        TableName: this.tableName,
        Key: { paymentLinkId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      }).promise();

      this.logger.info('Notification status updated', {
        paymentLinkId,
        smsStatus: result.Attributes.smsStatus,
        emailStatus: result.Attributes.emailStatus
      });

      return result.Attributes;

    } catch (error) {
      this.logger.error('Failed to update notification status', {
        error: error.message,
        paymentLinkId
      });

      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }
}

module.exports = DynamoService;
