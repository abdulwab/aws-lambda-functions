/**
 * Payment Link data model and validation
 */

class PaymentLink {
  constructor(data) {
    this.paymentLinkId = data.paymentLinkId;
    this.mxPaymentLinkId = data.mxPaymentLinkId;
    this.mxInvoiceId = data.mxInvoiceId;
    this.mxInvoiceNumber = data.mxInvoiceNumber;
    this.checkoutUrl = data.checkoutUrl;
    this.status = data.status;
    this.amount = data.amount;
    this.currency = data.currency;
    this.invoice = data.invoice;
    this.customer = data.customer;
    this.lineItems = data.lineItems || [];
    this.smsStatus = data.smsStatus;
    this.emailStatus = data.emailStatus;
    this.eventHistory = data.eventHistory || [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.transactionId = data.transactionId;
    this.ttl = data.ttl;
  }

  /**
   * Validate payment link data
   * @param {Object} data - Payment link data to validate
   * @returns {Object} - Validation result
   */
  static validate(data) {
    const errors = [];

    // Required fields
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      errors.push('Valid amount is required');
    }

    if (!data.invoice || !data.invoice.number) {
      errors.push('Invoice number is required');
    }

    if (!data.customer || !data.customer.name || !data.customer.email) {
      errors.push('Customer name and email are required');
    }

    // Validate email format
    if (data.customer && data.customer.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.customer.email)) {
        errors.push('Valid customer email is required');
      }
    }

    // Validate phone format (if provided)
    if (data.customer && data.customer.phone) {
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(data.customer.phone)) {
        errors.push('Valid customer phone number is required');
      }
    }

    // Validate currency
    if (data.currency && !['USD', 'CAD'].includes(data.currency)) {
      errors.push('Currency must be USD or CAD');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get status display information
   * @returns {Object} - Status display data
   */
  getStatusInfo() {
    const statusMap = {
      'created': {
        label: 'Created',
        description: 'Payment link has been created and is ready for use',
        color: 'blue'
      },
      'pending': {
        label: 'Pending',
        description: 'Payment is being processed',
        color: 'yellow'
      },
      'completed': {
        label: 'Completed',
        description: 'Payment has been successfully processed',
        color: 'green'
      },
      'failed': {
        label: 'Failed',
        description: 'Payment processing failed',
        color: 'red'
      },
      'cancelled': {
        label: 'Cancelled',
        description: 'Payment link has been cancelled or expired',
        color: 'gray'
      },
      'unknown': {
        label: 'Unknown',
        description: 'Payment status is unknown',
        color: 'gray'
      }
    };

    return statusMap[this.status] || statusMap['unknown'];
  }

  /**
   * Check if payment link is active
   * @returns {boolean} - Whether the payment link is active
   */
  isActive() {
    return ['created', 'pending'].includes(this.status);
  }

  /**
   * Check if payment link is completed
   * @returns {boolean} - Whether the payment link is completed
   */
  isCompleted() {
    return this.status === 'completed';
  }

  /**
   * Check if payment link has failed
   * @returns {boolean} - Whether the payment link has failed
   */
  hasFailed() {
    return this.status === 'failed';
  }

  /**
   * Get formatted amount
   * @returns {string} - Formatted amount string
   */
  getFormattedAmount() {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency || 'USD'
    }).format(this.amount);
  }

  /**
   * Get most recent event from history
   * @returns {Object|null} - Most recent event or null
   */
  getMostRecentEvent() {
    if (!this.eventHistory || this.eventHistory.length === 0) {
      return null;
    }
    return this.eventHistory[this.eventHistory.length - 1];
  }

  /**
   * Get events by type
   * @param {string} eventType - Event type to filter by
   * @returns {Array} - Filtered events
   */
  getEventsByType(eventType) {
    if (!this.eventHistory) {
      return [];
    }
    return this.eventHistory.filter(event => event.eventType === eventType);
  }

  /**
   * Convert to JSON object
   * @returns {Object} - JSON representation
   */
  toJSON() {
    return {
      paymentLinkId: this.paymentLinkId,
      mxPaymentLinkId: this.mxPaymentLinkId,
      checkoutUrl: this.checkoutUrl,
      status: this.status,
      amount: this.amount,
      currency: this.currency,
      invoice: this.invoice,
      customer: this.customer,
      lineItems: this.lineItems,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      transactionId: this.transactionId,
      statusInfo: this.getStatusInfo(),
      isActive: this.isActive(),
      isCompleted: this.isCompleted(),
      hasFailed: this.hasFailed(),
      formattedAmount: this.getFormattedAmount()
    };
  }
}

module.exports = PaymentLink;
