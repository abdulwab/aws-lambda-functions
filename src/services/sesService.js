/**
 * AWS SES Email service for sending payment link notifications
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const Logger = require('../utils/logger');

class SESService {
  constructor() {
    this.region = process.env.SES_REGION || process.env.AWS_REGION || 'us-east-2';
    this.fromEmail = process.env.SES_FROM_EMAIL;
    this.logger = new Logger({ service: 'SESService' });

    if (!this.fromEmail) {
      throw new Error('SES FROM email not configured');
    }

    this.client = new SESClient({ region: this.region });
  }

  /**
   * Send payment link via email
   * @param {string} to - Recipient email address
   * @param {string} customerName - Customer name
   * @param {string} paymentLink - The checkout URL
   * @param {Object} invoiceData - Invoice information
   * @returns {Promise<Object>} - SES send response
   */
  async sendPaymentLinkEmail(to, customerName, paymentLink, invoiceData) {
    try {
      const { invoiceNumber, amount, description, lineItems = [] } = invoiceData;

      this.logger.info('Sending payment link email', {
        to,
        invoiceNumber,
        amount
      });

      // Build line items HTML
      let lineItemsHtml = '';
      if (lineItems && lineItems.length > 0) {
        lineItemsHtml = `
          <h3 style="color: #333; margin-top: 20px;">Items:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Description</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Amount</th>
            </tr>
            ${lineItems.map(item => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${item.description}</td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">${item.quantity || 1}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">$${parseFloat(item.unitPrice || item.totalPrice || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
        `;
      }

      // HTML email template
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Payment Request</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello ${customerName},
              </p>
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
                You have a payment request for invoice <strong>${invoiceNumber}</strong>.
              </p>
              
              ${description ? `<p style="color: #666; font-size: 14px; margin: 0 0 20px 0;">${description}</p>` : ''}
              
              ${lineItemsHtml}
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
                <p style="color: #333; font-size: 18px; margin: 0;">
                  <strong>Total Amount:</strong>
                </p>
                <p style="color: #667eea; font-size: 32px; font-weight: bold; margin: 10px 0 0 0;">
                  $${parseFloat(amount).toFixed(2)}
                </p>
              </div>
              
              <!-- Payment Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      Pay Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0; text-align: center;">
                Or copy this link: <br/>
                <a href="${paymentLink}" style="color: #667eea; word-break: break-all;">${paymentLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated payment notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      // Plain text version
      const textBody = `
Payment Request for Invoice ${invoiceNumber}

Hello ${customerName},

You have a payment request for invoice ${invoiceNumber}.

${description ? description + '\n\n' : ''}
${lineItems.length > 0 ? 'Items:\n' + lineItems.map(item => `- ${item.description}: $${parseFloat(item.unitPrice || item.totalPrice || 0).toFixed(2)} x ${item.quantity || 1}`).join('\n') + '\n\n' : ''}
Total Amount: $${parseFloat(amount).toFixed(2)}

Click here to pay: ${paymentLink}

Thank you!
      `;

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: `Payment Request - Invoice ${invoiceNumber}`,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8'
            }
          }
        }
      });

      const result = await this.client.send(command);

      this.logger.info('Email sent successfully', {
        messageId: result.MessageId,
        to,
        invoiceNumber
      });

      return {
        success: true,
        messageId: result.MessageId,
        status: 'sent'
      };

    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error.message,
        to,
        invoiceNumber: invoiceData.invoiceNumber
      });

      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  /**
   * Send payment confirmation email
   * @param {string} to - Recipient email address
   * @param {string} customerName - Customer name
   * @param {Object} paymentData - Payment confirmation data
   * @returns {Promise<Object>} - SES send response
   */
  async sendPaymentConfirmationEmail(to, customerName, paymentData) {
    try {
      const { invoiceNumber, amount, transactionId } = paymentData;

      this.logger.info('Sending payment confirmation email', {
        to,
        invoiceNumber,
        transactionId
      });

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✓ Payment Confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <p style="color: #333; font-size: 18px; margin: 0 0 20px 0;">
                Hello ${customerName},
              </p>
              <p style="color: #666; font-size: 16px; margin: 0 0 30px 0;">
                Your payment for invoice <strong>${invoiceNumber}</strong> has been processed successfully!
              </p>
              <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="color: #333; font-size: 16px; margin: 0 0 10px 0;">Amount Paid:</p>
                <p style="color: #10b981; font-size: 32px; font-weight: bold; margin: 0;">$${parseFloat(amount).toFixed(2)}</p>
              </div>
              <p style="color: #666; font-size: 14px; margin: 20px 0;">
                <strong>Transaction ID:</strong> ${transactionId}
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Thank you for your payment!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const textBody = `
Payment Confirmed!

Hello ${customerName},

Your payment for invoice ${invoiceNumber} has been processed successfully!

Amount Paid: $${parseFloat(amount).toFixed(2)}
Transaction ID: ${transactionId}

Thank you for your payment!
      `;

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: `Payment Confirmed - Invoice ${invoiceNumber}`,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8'
            }
          }
        }
      });

      const result = await this.client.send(command);

      this.logger.info('Payment confirmation email sent', {
        messageId: result.MessageId,
        to,
        invoiceNumber
      });

      return {
        success: true,
        messageId: result.MessageId,
        status: 'sent'
      };

    } catch (error) {
      this.logger.error('Failed to send payment confirmation email', {
        error: error.message,
        to,
        invoiceNumber: paymentData.invoiceNumber
      });

      throw new Error(`Payment confirmation email failed: ${error.message}`);
    }
  }
}

module.exports = SESService;
