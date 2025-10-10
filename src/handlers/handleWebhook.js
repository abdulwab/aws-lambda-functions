/**
 * Lambda handler for processing MX Merchant webhook notifications
 */

const MXMerchantService = require('../services/mxMerchantService');
const DynamoService = require('../services/dynamoService');
const TwilioService = require('../services/twilioService');
const { success, error, serverError } = require('../utils/response');
const Logger = require('../utils/logger');

exports.handler = async (event, context) => {
  const logger = new Logger({ 
    function: 'handleWebhook',
    requestId: context.awsRequestId 
  });

  try {
    logger.info('Processing webhook notification', {
      method: event.httpMethod,
      path: event.path,
      headers: event.headers
    });

    // Parse webhook payload
    let webhookData;
    try {
      webhookData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      logger.error('Invalid JSON in webhook payload', { error: parseError.message });
      return error('Invalid JSON in webhook payload', 400);
    }

    // Initialize services
    const mxMerchantService = new MXMerchantService();
    const dynamoService = new DynamoService();
    const twilioService = new TwilioService();

    // Process webhook data
    const processedWebhook = mxMerchantService.processWebhook(webhookData);

    logger.info('📥 WEBHOOK RECEIVED: Processing webhook event', {
      invoiceId: processedWebhook.invoiceId,
      eventType: processedWebhook.eventType,
      status: processedWebhook.status,
      amount: processedWebhook.amount,
      paidAmount: processedWebhook.paidAmount,
      balance: processedWebhook.balance,
      transactionId: processedWebhook.transactionId,
      timestamp: processedWebhook.timestamp
    });

    // Find the payment link in our database using MX Invoice ID
    // Scan for records with matching mxInvoiceId
    const allPaymentLinks = await dynamoService.getPaymentLinksByStatus('created');
    let paymentLink = allPaymentLinks.find(link => 
      link.mxInvoiceId === processedWebhook.invoiceId
    );

    // If not found in 'created', check other statuses
    if (!paymentLink) {
      const pendingLinks = await dynamoService.getPaymentLinksByStatus('pending');
      paymentLink = pendingLinks.find(link => link.mxInvoiceId === processedWebhook.invoiceId);
    }

    if (!paymentLink) {
      logger.warn('Invoice not found in database', {
        mxInvoiceId: processedWebhook.invoiceId
      });
      return error('Invoice not found', 404);
    }

    // Determine new status based on event type
    let newStatus;
    let additionalData = {
      transactionId: processedWebhook.transactionId,
      paymentMethod: processedWebhook.paymentMethod,
      paidAmount: processedWebhook.paidAmount,
      balance: processedWebhook.balance,
      webhookReceivedAt: processedWebhook.timestamp,
      invoiceNumber: processedWebhook.metadata.invoiceNumber,
      receiptNumber: processedWebhook.metadata.receiptNumber
    };

    const eventType = (processedWebhook.eventType || '').toLowerCase();

    // Map MX Invoice events to internal status
    let eventDescription = '';
    
    if (eventType.includes('paid') || eventType.includes('payment.completed') || processedWebhook.status === 'completed') {
      newStatus = 'completed';
      additionalData.completedAt = processedWebhook.timestamp;
      eventDescription = `Payment completed - $${processedWebhook.paidAmount}`;
      logger.info('✅ EVENT: Payment Completed', {
        invoiceId: processedWebhook.invoiceId,
        paidAmount: processedWebhook.paidAmount,
        transactionId: processedWebhook.transactionId
      });
    } else if (eventType.includes('fail') || eventType.includes('declined') || processedWebhook.status === 'failed') {
      newStatus = 'failed';
      additionalData.failedAt = processedWebhook.timestamp;
      additionalData.failureReason = processedWebhook.metadata?.reason || 'Payment failed';
      eventDescription = `Payment failed - ${additionalData.failureReason}`;
      logger.error('❌ EVENT: Payment Failed', {
        invoiceId: processedWebhook.invoiceId,
        reason: additionalData.failureReason,
        amount: processedWebhook.amount
      });
    } else if (eventType.includes('partial') || processedWebhook.status === 'partial') {
      newStatus = 'partial';
      additionalData.partiallyPaidAt = processedWebhook.timestamp;
      eventDescription = `Partial payment received - $${processedWebhook.paidAmount} of $${processedWebhook.amount}`;
      logger.info('💰 EVENT: Partial Payment', {
        invoiceId: processedWebhook.invoiceId,
        paidAmount: processedWebhook.paidAmount,
        remainingBalance: processedWebhook.balance
      });
    } else if (eventType.includes('cancel') || eventType.includes('void') || eventType.includes('expired')) {
      newStatus = 'cancelled';
      additionalData.cancelledAt = processedWebhook.timestamp;
      eventDescription = 'Invoice cancelled or voided';
      logger.warn('🚫 EVENT: Invoice Cancelled/Voided', {
        invoiceId: processedWebhook.invoiceId,
        eventType: processedWebhook.eventType
      });
    } else if (eventType.includes('sent') || eventType.includes('created') || eventType.includes('unpaid')) {
      newStatus = 'pending';
      additionalData.sentAt = processedWebhook.timestamp;
      eventDescription = 'Invoice sent to customer';
      logger.info('📤 EVENT: Invoice Sent/Unpaid', {
        invoiceId: processedWebhook.invoiceId,
        amount: processedWebhook.amount,
        customerEmail: processedWebhook.metadata.customerEmail
      });
    } else {
      logger.warn('⚠️ EVENT: Unknown Event Type', {
        eventType: processedWebhook.eventType,
        mappedStatus: processedWebhook.status,
        invoiceId: processedWebhook.invoiceId
      });
      newStatus = processedWebhook.status || 'unknown';
      additionalData.unknownEventType = processedWebhook.eventType;
      eventDescription = `Unknown event: ${processedWebhook.eventType}`;
    }

    // Update payment link status in database
    const updatedRecord = await dynamoService.updatePaymentLinkStatus(
      paymentLink.paymentLinkId,
      newStatus,
      additionalData
    );

    logger.info('💾 DATABASE: Payment link status updated', {
      paymentLinkId: paymentLink.paymentLinkId,
      oldStatus: paymentLink.status,
      newStatus: newStatus,
      transactionId: processedWebhook.transactionId
    });

    // Add event to history for audit trail
    try {
      await dynamoService.addEventToHistory(paymentLink.paymentLinkId, {
        eventType: processedWebhook.eventType,
        status: newStatus,
        timestamp: processedWebhook.timestamp,
        source: 'mx_merchant_webhook',
        description: eventDescription,
        metadata: {
          transactionId: processedWebhook.transactionId,
          paymentMethod: processedWebhook.paymentMethod,
          paidAmount: processedWebhook.paidAmount,
          balance: processedWebhook.balance,
          invoiceNumber: processedWebhook.metadata.invoiceNumber,
          receiptNumber: processedWebhook.metadata.receiptNumber,
          rawEventType: processedWebhook.eventType
        }
      });

      logger.info('📝 HISTORY: Event added to history', {
        paymentLinkId: paymentLink.paymentLinkId,
        eventType: processedWebhook.eventType,
        status: newStatus
      });
    } catch (historyError) {
      logger.error('⚠️ HISTORY: Failed to add event to history (non-fatal)', {
        error: historyError.message,
        paymentLinkId: paymentLink.paymentLinkId
      });
      // Don't fail the webhook processing if history logging fails
    }

    // Send SMS notifications based on status
    let smsResult = null;
    if (paymentLink.customer.phone) {
      try {
        switch (newStatus) {
          case 'completed':
            logger.info('📱 SMS: Sending payment confirmation SMS', {
              phone: paymentLink.customer.phone,
              invoiceNumber: paymentLink.invoice.number,
              amount: paymentLink.amount
            });

            smsResult = await twilioService.sendPaymentConfirmationSMS(
              paymentLink.customer.phone,
              {
                invoiceNumber: paymentLink.invoice.number,
                amount: paymentLink.amount,
                transactionId: processedWebhook.transactionId
              }
            );
            
            logger.info('📱 SMS: ✅ Payment confirmation sent successfully', {
              messageSid: smsResult.messageSid,
              status: smsResult.status,
              phone: paymentLink.customer.phone
            });
            break;

          case 'failed':
            logger.info('📱 SMS: Sending payment failure SMS', {
              phone: paymentLink.customer.phone,
              invoiceNumber: paymentLink.invoice.number,
              reason: additionalData.failureReason
            });

            smsResult = await twilioService.sendPaymentFailureSMS(
              paymentLink.customer.phone,
              {
                invoiceNumber: paymentLink.invoice.number,
                amount: paymentLink.amount,
                reason: additionalData.failureReason || 'Payment processing failed'
              }
            );
            
            logger.info('📱 SMS: ✅ Payment failure notification sent', {
              messageSid: smsResult.messageSid,
              status: smsResult.status,
              phone: paymentLink.customer.phone
            });
            break;

          case 'partial':
            logger.info('📱 SMS: ℹ️ Partial payment - no SMS notification configured', {
              status: newStatus,
              paidAmount: processedWebhook.paidAmount,
              balance: processedWebhook.balance
            });
            break;

          default:
            logger.info('📱 SMS: ℹ️ No SMS notification needed for status', { 
              status: newStatus,
              eventType: processedWebhook.eventType
            });
        }

      } catch (smsError) {
        logger.error('📱 SMS: ❌ Failed to send SMS notification', {
          error: smsError.message,
          phone: paymentLink.customer.phone,
          status: newStatus,
          stack: smsError.stack
        });
        // Don't fail the webhook if SMS fails
      }
    } else {
      logger.warn('📱 SMS: ⚠️ No phone number on file for customer', {
        paymentLinkId: paymentLink.paymentLinkId,
        customerEmail: paymentLink.customer.email
      });
    }

    // Prepare response
    const responseData = {
      paymentLinkId: paymentLink.paymentLinkId,
      mxInvoiceId: processedWebhook.invoiceId,
      mxInvoiceNumber: processedWebhook.metadata.invoiceNumber,
      status: newStatus,
      eventType: processedWebhook.eventType,
      transactionId: processedWebhook.transactionId,
      paidAmount: processedWebhook.paidAmount,
      balance: processedWebhook.balance,
      paymentMethod: processedWebhook.paymentMethod,
      updatedAt: updatedRecord.updatedAt,
      smsNotification: smsResult ? {
        sent: true,
        messageSid: smsResult.messageSid,
        status: smsResult.status
      } : {
        sent: false,
        reason: paymentLink.customer.phone ? 'SMS sending failed' : 'No phone number on file'
      }
    };

    logger.info('Webhook processed successfully', {
      paymentLinkId: paymentLink.paymentLinkId,
      eventType: processedWebhook.eventType,
      newStatus: newStatus
    });

    return success(responseData);

  } catch (error) {
    logger.error('Failed to process webhook', {
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('credentials not configured')) {
      return serverError('Service configuration error');
    }

    return serverError('Failed to process webhook', error.message);
  }
};
