/**
 * Lambda handler for creating MX Merchant payment links
 */

const MXMerchantService = require('../services/mxMerchantService');
const DynamoService = require('../services/dynamoService');
const TwilioService = require('../services/twilioService');
const SESService = require('../services/sesService');
const { success, error, badRequest, serverError } = require('../utils/response');
const Logger = require('../utils/logger');

exports.handler = async (event, context) => {
  const logger = new Logger({ 
    function: 'createPaymentLink',
    requestId: context.awsRequestId 
  });

  try {
    logger.info('Processing create payment link request', {
      method: event.httpMethod,
      path: event.path
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      logger.error('Invalid JSON in request body', { error: parseError.message });
      return badRequest('Invalid JSON in request body');
    }

    // Validate required fields
    const requiredFields = ['amount', 'invoice', 'customer'];
    const missingFields = requiredFields.filter(field => !requestBody[field]);
    
    if (missingFields.length > 0) {
      logger.warn('Missing required fields', { missingFields });
      return badRequest(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate invoice data
    if (!requestBody.invoice.number) {
      return badRequest('Invoice number is required');
    }

    // Validate customer data
    if (!requestBody.customer.name || !requestBody.customer.email) {
      return badRequest('Customer name and email are required');
    }

    // Validate amount
    const amount = parseFloat(requestBody.amount);
    if (isNaN(amount) || amount <= 0) {
      return badRequest('Valid amount is required');
    }

    // Initialize services
    const mxMerchantService = new MXMerchantService();
    const dynamoService = new DynamoService();
    const twilioService = new TwilioService();
    const sesService = new SESService();

    // Prepare payment data for MX Merchant
    const paymentData = {
      amount: amount,
      currency: requestBody.currency || 'USD',
      invoice: {
        number: requestBody.invoice.number,
        description: requestBody.invoice.description || `Payment for ${requestBody.invoice.number}`
      },
      customer: {
        name: requestBody.customer.name,
        email: requestBody.customer.email,
        phone: requestBody.customer.phone
      },
      redirectUrl: requestBody.redirectUrl || 'https://celebrationchevrolet.com/payment/success',
      cancelUrl: requestBody.cancelUrl || 'https://celebrationchevrolet.com/payment/cancel',
      lineItems: requestBody.lineItems || []
    };

    logger.info('Creating payment link with MX Merchant', {
      invoiceNumber: paymentData.invoice.number,
      amount: paymentData.amount,
      customerEmail: paymentData.customer.email
    });

    // Create payment link with MX Merchant
    const mxResponse = await mxMerchantService.createPaymentLink(paymentData);

    // Store payment link in DynamoDB
    const dbRecord = await dynamoService.createPaymentLink({
      mxPaymentLinkId: mxResponse.paymentLinkId,
      checkoutUrl: mxResponse.checkoutUrl,
      amount: paymentData.amount,
      currency: paymentData.currency,
      invoice: paymentData.invoice,
      customer: paymentData.customer,
      lineItems: paymentData.lineItems
    });

    // Send SMS notification if phone number is provided
    let smsResult = null;
    let smsStatus = 'not_sent';
    let smsMessageSid = null;
    
    if (requestBody.customer.phone && requestBody.sendSMS !== false) {
      try {
        logger.info('Sending SMS notification', {
          phone: requestBody.customer.phone,
          invoiceNumber: paymentData.invoice.number
        });

        smsResult = await twilioService.sendPaymentLinkSMS(
          requestBody.customer.phone,
          mxResponse.checkoutUrl,
          {
            invoiceNumber: paymentData.invoice.number,
            customerName: paymentData.customer.name,
            amount: paymentData.amount
          }
        );

        smsStatus = 'sent';
        smsMessageSid = smsResult.messageSid;

        logger.info('SMS notification sent successfully', {
          messageSid: smsResult.messageSid
        });
      } catch (smsError) {
        smsStatus = 'failed';
        logger.error('Failed to send SMS notification', {
          error: smsError.message,
          phone: requestBody.customer.phone
        });
        // Don't fail the entire request if SMS fails
      }
    }

    // Send Email notification
    let emailResult = null;
    let emailStatus = 'not_sent';
    let emailMessageId = null;
    
    if (requestBody.customer.email && requestBody.sendEmail !== false) {
      try {
        logger.info('Sending email notification', {
          email: requestBody.customer.email,
          invoiceNumber: paymentData.invoice.number
        });

        emailResult = await sesService.sendPaymentLinkEmail(
          requestBody.customer.email,
          paymentData.customer.name,
          mxResponse.checkoutUrl,
          {
            invoiceNumber: paymentData.invoice.number,
            amount: paymentData.amount,
            description: paymentData.invoice.description,
            lineItems: paymentData.lineItems
          }
        );

        emailStatus = 'sent';
        emailMessageId = emailResult.messageId;

        logger.info('Email notification sent successfully', {
          messageId: emailResult.messageId
        });
      } catch (emailError) {
        emailStatus = 'failed';
        logger.error('Failed to send email notification', {
          error: emailError.message,
          email: requestBody.customer.email
        });
        // Don't fail the entire request if email fails
      }
    }

    // Update notification status in DynamoDB
    const notificationStatus = {
      smsStatus,
      emailStatus
    };

    if (smsMessageSid) {
      notificationStatus.smsMessageSid = smsMessageSid;
      notificationStatus.smsSentAt = new Date().toISOString();
    }

    if (emailMessageId) {
      notificationStatus.emailMessageId = emailMessageId;
      notificationStatus.emailSentAt = new Date().toISOString();
    }

    try {
      await dynamoService.updateNotificationStatus(dbRecord.paymentLinkId, notificationStatus);
      logger.info('Notification status updated in database', {
        paymentLinkId: dbRecord.paymentLinkId,
        smsStatus,
        emailStatus
      });
    } catch (updateError) {
      logger.error('Failed to update notification status', {
        error: updateError.message,
        paymentLinkId: dbRecord.paymentLinkId
      });
      // Don't fail the entire request if status update fails
    }

    // Prepare response
    const responseData = {
      paymentLinkId: dbRecord.paymentLinkId,
      mxPaymentLinkId: mxResponse.paymentLinkId,
      checkoutUrl: mxResponse.checkoutUrl,
      status: dbRecord.status,
      amount: dbRecord.amount,
      currency: dbRecord.currency,
      invoice: dbRecord.invoice,
      customer: dbRecord.customer,
      createdAt: dbRecord.createdAt,
      smsNotification: {
        sent: smsStatus === 'sent',
        status: smsStatus,
        messageSid: smsMessageSid,
        reason: smsStatus === 'not_sent' ? 
          (requestBody.customer.phone ? 'SMS disabled' : 'No phone number provided') :
          smsStatus === 'failed' ? 'SMS sending failed' : null
      },
      emailNotification: {
        sent: emailStatus === 'sent',
        status: emailStatus,
        messageId: emailMessageId,
        reason: emailStatus === 'not_sent' ? 
          (requestBody.customer.email ? 'Email disabled' : 'No email provided') :
          emailStatus === 'failed' ? 'Email sending failed' : null
      }
    };

    logger.info('Payment link created successfully', {
      paymentLinkId: dbRecord.paymentLinkId,
      invoiceNumber: paymentData.invoice.number
    });

    return success(responseData, 201);

  } catch (error) {
    logger.error('Failed to create payment link', {
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('credentials not configured')) {
      return serverError('Service configuration error');
    }

    return serverError('Failed to create payment link', error.message);
  }
};
