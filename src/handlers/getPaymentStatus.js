/**
 * Lambda handler for retrieving payment link status
 */

const DynamoService = require('../services/dynamoService');
const MXMerchantService = require('../services/mxMerchantService');
const { success, error, notFound, serverError } = require('../utils/response');
const Logger = require('../utils/logger');

exports.handler = async (event, context) => {
  const logger = new Logger({ 
    function: 'getPaymentStatus',
    requestId: context.awsRequestId 
  });

  try {
    logger.info('Processing get payment status request', {
      method: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters
    });

    // Extract payment link ID from path parameters
    const paymentLinkId = event.pathParameters?.id;
    
    if (!paymentLinkId) {
      logger.warn('Payment link ID not provided in path');
      return error('Payment link ID is required', 400);
    }

    // Initialize services
    const dynamoService = new DynamoService();
    const mxMerchantService = new MXMerchantService();

    // Get payment link from database
    const paymentLink = await dynamoService.getPaymentLink(paymentLinkId);

    if (!paymentLink) {
      logger.warn('Payment link not found', { paymentLinkId });
      return notFound('Payment link not found');
    }

    logger.info('Payment link found in database', {
      paymentLinkId,
      status: paymentLink.status,
      invoiceNumber: paymentLink.invoice.number
    });

    // Get latest status from MX Merchant if we have the MX payment link ID
    let mxStatus = null;
    if (paymentLink.mxPaymentLinkId) {
      try {
        logger.info('Fetching latest status from MX Merchant', {
          mxPaymentLinkId: paymentLink.mxPaymentLinkId
        });

        const mxResponse = await mxMerchantService.getPaymentLinkStatus(paymentLink.mxPaymentLinkId);
        mxStatus = mxResponse;

        // Update our database if the status has changed
        if (mxResponse.status !== paymentLink.status) {
          logger.info('Status mismatch detected, updating database', {
            dbStatus: paymentLink.status,
            mxStatus: mxResponse.status
          });

          const additionalData = {
            transactionId: mxResponse.transactionId,
            lastSyncAt: new Date().toISOString()
          };

          await dynamoService.updatePaymentLinkStatus(
            paymentLinkId,
            mxResponse.status,
            additionalData
          );

          // Update local payment link object
          paymentLink.status = mxResponse.status;
          paymentLink.transactionId = mxResponse.transactionId;
          paymentLink.lastSyncAt = additionalData.lastSyncAt;
        }

      } catch (mxError) {
        logger.error('Failed to fetch status from MX Merchant', {
          error: mxError.message,
          mxPaymentLinkId: paymentLink.mxPaymentLinkId
        });
        // Continue with database status if MX Merchant call fails
      }
    }

    // Prepare response data
    const responseData = {
      paymentLinkId: paymentLink.paymentLinkId,
      mxPaymentLinkId: paymentLink.mxPaymentLinkId,
      checkoutUrl: paymentLink.checkoutUrl,
      status: paymentLink.status,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      invoice: paymentLink.invoice,
      customer: {
        name: paymentLink.customer.name,
        email: paymentLink.customer.email
        // Don't expose phone number in status response
      },
      lineItems: paymentLink.lineItems,
      createdAt: paymentLink.createdAt,
      updatedAt: paymentLink.updatedAt,
      transactionId: paymentLink.transactionId,
      lastSyncAt: paymentLink.lastSyncAt,
      mxMerchantStatus: mxStatus ? {
        status: mxStatus.status,
        amount: mxStatus.amount,
        currency: mxStatus.currency,
        transactionId: mxStatus.transactionId,
        lastUpdated: mxStatus.updatedAt
      } : null
    };

    // Add status-specific fields
    if (paymentLink.status === 'completed' && paymentLink.completedAt) {
      responseData.completedAt = paymentLink.completedAt;
    }

    if (paymentLink.status === 'failed' && paymentLink.failedAt) {
      responseData.failedAt = paymentLink.failedAt;
      responseData.failureReason = paymentLink.failureReason;
    }

    if (paymentLink.status === 'cancelled' && paymentLink.cancelledAt) {
      responseData.cancelledAt = paymentLink.cancelledAt;
    }

    logger.info('Payment status retrieved successfully', {
      paymentLinkId,
      status: paymentLink.status,
      invoiceNumber: paymentLink.invoice.number
    });

    return success(responseData);

  } catch (error) {
    logger.error('Failed to get payment status', {
      error: error.message,
      stack: error.stack,
      paymentLinkId: event.pathParameters?.id
    });

    if (error.message.includes('credentials not configured')) {
      return serverError('Service configuration error');
    }

    return serverError('Failed to get payment status', error.message);
  }
};
