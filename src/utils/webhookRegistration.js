/**
 * Utility for registering/managing MX Merchant webhooks
 * 
 * This is a one-time setup utility, NOT part of the Lambda runtime.
 * Use this to register your webhook with MX Merchant API.
 * 
 * Usage:
 *   node src/utils/webhookRegistration.js register
 *   node src/utils/webhookRegistration.js list
 *   node src/utils/webhookRegistration.js update <notificationId>
 *   node src/utils/webhookRegistration.js delete <notificationId>
 */

require('dotenv').config();
const axios = require('axios');

class WebhookRegistration {
  constructor() {
    this.apiUrl = process.env.MX_MERCHANT_API_URL;
    this.merchantId = process.env.MX_MERCHANT_MERCHANT_ID;
    
    // Support both authentication methods
    const consumerKey = process.env.MX_MERCHANT_CONSUMER_KEY;
    const consumerSecret = process.env.MX_MERCHANT_CONSUMER_SECRET;
    const username = process.env.MX_USERNAME;
    const password = process.env.MX_PASSWORD;

    let auth;
    if (consumerKey && consumerSecret) {
      auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      console.log('✅ Using Consumer Key/Secret authentication');
    } else if (username && password) {
      auth = Buffer.from(`${username}:${password}`).toString('base64');
      console.log('✅ Using Username/Password authentication');
    } else {
      throw new Error('❌ MX Merchant credentials not configured');
    }

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
   * Get the webhook URL from serverless deployment
   * You should replace this with your actual API Gateway URL after deployment
   */
  getWebhookUrl() {
    // TODO: Update this with your actual webhook URL after deployment
    const webhookUrl = process.env.WEBHOOK_URL || 
                      'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dev/webhook';
    
    if (webhookUrl.includes('YOUR-API-ID')) {
      console.warn('⚠️  WARNING: Please update WEBHOOK_URL in .env with your actual API Gateway URL');
      console.warn('   You can find it after running: serverless deploy');
      console.warn('   Or in AWS Console → API Gateway → Stages');
    }
    
    return webhookUrl;
  }

  /**
   * Get all available event types from MX Merchant
   */
  async getEventTypes() {
    try {
      console.log('\n📋 Fetching available event types...');
      const response = await this.client.get('/notification/eventTypes');
      
      console.log('\n✅ Available Event Types:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch event types:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List existing webhook notifications
   */
  async listNotifications() {
    try {
      console.log('\n📋 Fetching existing notifications...');
      const response = await this.client.get('/notification', {
        params: { merchantId: this.merchantId }
      });
      
      console.log(`\n✅ Found ${response.data.length} notification(s):\n`);
      response.data.forEach((notif, index) => {
        console.log(`${index + 1}. ID: ${notif.id}`);
        console.log(`   Event Type: ${notif.eventType}`);
        console.log(`   Events: ${notif.events?.join(', ') || 'N/A'}`);
        console.log(`   URL: ${notif.notifyUrl}`);
        console.log(`   Enabled: ${notif.enabled}`);
        console.log(`   Merchant ID: ${notif.merchantId}`);
        console.log('');
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to list notifications:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Register new webhook notification
   */
  async registerWebhook() {
    try {
      const webhookUrl = this.getWebhookUrl();
      
      console.log('\n📝 Registering new webhook notification...');
      console.log(`   Merchant ID: ${this.merchantId}`);
      console.log(`   Webhook URL: ${webhookUrl}`);
      
      const notificationData = {
        merchantId: parseInt(this.merchantId),
        eventType: 'Invoice',
        notifyUrl: webhookUrl,
        enabled: true,
        events: [
          'Paid',
          'PartiallyPaid',
          'Unpaid',
          'Failed',
          'Cancelled',
          'Voided'
        ]
      };

      console.log('\n📤 Sending registration request...');
      console.log(JSON.stringify(notificationData, null, 2));

      const response = await this.client.post('/notification?echo=true', notificationData);
      
      console.log('\n✅ Webhook registered successfully!');
      console.log('\n📋 Notification Details:');
      console.log(JSON.stringify(response.data, null, 2));
      
      console.log('\n🎉 All done! Your webhook is now active.');
      console.log('\n📝 Save this Notification ID for future reference: ' + response.data.id);
      
      return response.data;
    } catch (error) {
      console.error('\n❌ Failed to register webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Update existing webhook notification
   */
  async updateWebhook(notificationId) {
    try {
      const webhookUrl = this.getWebhookUrl();
      
      console.log(`\n📝 Updating webhook notification ID: ${notificationId}...`);
      
      const updateData = {
        id: parseInt(notificationId),
        merchantId: parseInt(this.merchantId),
        eventType: 'Invoice',
        notifyUrl: webhookUrl,
        enabled: true,
        events: [
          'Paid',
          'PartiallyPaid',
          'Unpaid',
          'Failed',
          'Cancelled',
          'Voided'
        ]
      };

      console.log('\n📤 Sending update request...');
      console.log(JSON.stringify(updateData, null, 2));

      const response = await this.client.put(`/notification/${notificationId}?echo=true`, updateData);
      
      console.log('\n✅ Webhook updated successfully!');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('\n❌ Failed to update webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete webhook notification
   */
  async deleteWebhook(notificationId) {
    try {
      console.log(`\n🗑️  Deleting webhook notification ID: ${notificationId}...`);
      
      await this.client.delete(`/notification/${notificationId}`);
      
      console.log('\n✅ Webhook deleted successfully!');
      
    } catch (error) {
      console.error('\n❌ Failed to delete webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get specific notification by ID
   */
  async getNotification(notificationId) {
    try {
      console.log(`\n📋 Fetching notification ID: ${notificationId}...`);
      
      const response = await this.client.get(`/notification/${notificationId}`);
      
      console.log('\n✅ Notification Details:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('\n❌ Failed to fetch notification:', error.response?.data || error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('\n🔧 MX Merchant Webhook Registration Utility\n');

  try {
    const registration = new WebhookRegistration();

    switch (command) {
      case 'event-types':
      case 'events':
        await registration.getEventTypes();
        break;

      case 'list':
      case 'ls':
        await registration.listNotifications();
        break;

      case 'register':
      case 'create':
        await registration.registerWebhook();
        break;

      case 'update':
        if (!arg) {
          console.error('❌ Error: Notification ID required');
          console.log('Usage: node webhookRegistration.js update <notificationId>');
          process.exit(1);
        }
        await registration.updateWebhook(arg);
        break;

      case 'delete':
      case 'remove':
        if (!arg) {
          console.error('❌ Error: Notification ID required');
          console.log('Usage: node webhookRegistration.js delete <notificationId>');
          process.exit(1);
        }
        await registration.deleteWebhook(arg);
        break;

      case 'get':
        if (!arg) {
          console.error('❌ Error: Notification ID required');
          console.log('Usage: node webhookRegistration.js get <notificationId>');
          process.exit(1);
        }
        await registration.getNotification(arg);
        break;

      case 'help':
      case '-h':
      case '--help':
      default:
        console.log('📖 Available Commands:\n');
        console.log('  event-types          - List all available event types');
        console.log('  list                 - List all existing webhook notifications');
        console.log('  register             - Register new webhook notification');
        console.log('  update <id>          - Update existing webhook notification');
        console.log('  get <id>             - Get specific notification details');
        console.log('  delete <id>          - Delete webhook notification');
        console.log('  help                 - Show this help message');
        console.log('\n📝 Examples:\n');
        console.log('  node src/utils/webhookRegistration.js list');
        console.log('  node src/utils/webhookRegistration.js register');
        console.log('  node src/utils/webhookRegistration.js update 12345');
        console.log('  node src/utils/webhookRegistration.js delete 12345');
        console.log('\n💡 Tip: Set WEBHOOK_URL in .env before registering\n');
        break;
    }

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = WebhookRegistration;

