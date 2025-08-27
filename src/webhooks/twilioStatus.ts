export interface TwilioStatusWebhook {
  MessageSid: string;
  MessageStatus: 'queued' | 'failed' | 'sent' | 'delivered' | 'undelivered';
  ErrorCode?: string;
  ErrorMessage?: string;
  To: string;
  From: string;
  Body?: string;
  DateCreated?: string;
  DateUpdated?: string;
}

export interface WebhookHandler {
  handleStatusUpdate(webhook: TwilioStatusWebhook): Promise<void>;
  handleDeliveryFailure(webhook: TwilioStatusWebhook): Promise<void>;
  handleDeliverySuccess(webhook: TwilioStatusWebhook): Promise<void>;
}

export class TwilioStatusHandler implements WebhookHandler {
  private db: any;

  constructor(database: any) {
    this.db = database;
  }

  async handleStatusUpdate(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      console.log(`Processing Twilio status update for message ${webhook.MessageSid}: ${webhook.MessageStatus}`);

      // Store webhook data for tracking
      await this.storeWebhookData(webhook);

      // Handle different status types
      switch (webhook.MessageStatus) {
        case 'delivered':
          await this.handleDeliverySuccess(webhook);
          break;
        case 'failed':
        case 'undelivered':
          await this.handleDeliveryFailure(webhook);
          break;
        case 'sent':
          await this.handleMessageSent(webhook);
          break;
        default:
          console.log(`Status ${webhook.MessageStatus} for message ${webhook.MessageSid}`);
      }

    } catch (error) {
      console.error('Error handling Twilio status update:', error);
    }
  }

  async handleDeliverySuccess(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      console.log(`Message ${webhook.MessageSid} delivered successfully to ${webhook.To}`);

      // Update notification status in queue
      await this.updateNotificationStatus(webhook.MessageSid, 'delivered');

      // Log successful delivery
      await this.logDeliverySuccess(webhook);

      // Update delivery statistics
      await this.updateDeliveryStats(webhook, true);

    } catch (error) {
      console.error('Error handling delivery success:', error);
    }
  }

  async handleDeliveryFailure(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      console.log(`Message ${webhook.MessageSid} delivery failed to ${webhook.To}`);
      console.log(`Error: ${webhook.ErrorCode} - ${webhook.ErrorMessage}`);

      // Update notification status in queue
      await this.updateNotificationStatus(webhook.MessageSid, 'failed');

      // Log delivery failure
      await this.logDeliveryFailure(webhook);

      // Update delivery statistics
      await this.updateDeliveryStats(webhook, false);

      // Handle retry logic if needed
      await this.handleRetryLogic(webhook);

    } catch (error) {
      console.error('Error handling delivery failure:', error);
    }
  }

  async handleMessageSent(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      console.log(`Message ${webhook.MessageSid} sent to Twilio for delivery to ${webhook.To}`);

      // Update notification status in queue
      await this.updateNotificationStatus(webhook.MessageSid, 'sent');

      // Log message sent
      await this.logMessageSent(webhook);

    } catch (error) {
      console.error('Error handling message sent:', error);
    }
  }

  private async storeWebhookData(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      const collection = this.db.collection('twilioWebhooks');
      await collection.insertOne({
        messageSid: webhook.MessageSid,
        status: webhook.MessageStatus,
        errorCode: webhook.ErrorCode,
        errorMessage: webhook.ErrorMessage,
        to: webhook.To,
        from: webhook.From,
        body: webhook.Body,
        dateCreated: webhook.DateCreated ? new Date(webhook.DateCreated) : new Date(),
        dateUpdated: webhook.DateUpdated ? new Date(webhook.DateUpdated) : new Date(),
        receivedAt: new Date()
      });
    } catch (error) {
      console.error('Error storing webhook data:', error);
    }
  }

  private async updateNotificationStatus(messageSid: string, status: string): Promise<void> {
    try {
      // Try to find the notification by Twilio message SID
      const collection = this.db.collection('notificationQueue');
      
      // First, try to find by messageSid in metadata
      const result = await collection.updateOne(
        { 'metadata.twilioMessageSid': messageSid },
        { 
          $set: { 
            status: status === 'delivered' ? 'sent' : status,
            updatedAt: new Date(),
            'metadata.lastTwilioStatus': status,
            'metadata.lastTwilioUpdate': new Date()
          }
        }
      );

      if (result.modifiedCount === 0) {
        // If not found, log for debugging
        console.log(`No notification found for Twilio message SID: ${messageSid}`);
      }
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }

  private async logDeliverySuccess(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      const collection = this.db.collection('deliveryLogs');
      await collection.insertOne({
        messageSid: webhook.MessageSid,
        status: 'success',
        recipient: webhook.To,
        timestamp: new Date(),
        twilioStatus: webhook.MessageStatus,
        deliveryTime: new Date()
      });
    } catch (error) {
      console.error('Error logging delivery success:', error);
    }
  }

  private async logDeliveryFailure(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      const collection = this.db.collection('deliveryLogs');
      await collection.insertOne({
        messageSid: webhook.MessageSid,
        status: 'failure',
        recipient: webhook.To,
        timestamp: new Date(),
        twilioStatus: webhook.MessageStatus,
        errorCode: webhook.ErrorCode,
        errorMessage: webhook.ErrorMessage,
        failureTime: new Date()
      });
    } catch (error) {
      console.error('Error logging delivery failure:', error);
    }
  }

  private async logMessageSent(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      const collection = this.db.collection('deliveryLogs');
      await collection.insertOne({
        messageSid: webhook.MessageSid,
        status: 'sent',
        recipient: webhook.To,
        timestamp: new Date(),
        twilioStatus: webhook.MessageStatus,
        sentTime: new Date()
      });
    } catch (error) {
      console.error('Error logging message sent:', error);
    }
  }

  private async updateDeliveryStats(_webhook: TwilioStatusWebhook, success: boolean): Promise<void> {
    try {
      const collection = this.db.collection('deliveryStats');
      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      await collection.updateOne(
        { date: dateKey },
        {
          $inc: {
            totalMessages: 1,
            successfulDeliveries: success ? 1 : 0,
            failedDeliveries: success ? 0 : 1
          },
          $set: {
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating delivery stats:', error);
    }
  }

  private async handleRetryLogic(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      // Check if this is a retryable error
      const retryableErrors = [
        '30001', // Queue overflow
        '30002', // Account suspended
        '30003', // Account closed
        '30004', // Account not active
        '30005', // From number not verified
        '30006', // From number not owned by account
        '30007', // From number not SMS capable
        '30008', // From number not voice capable
        '30009', // From number not owned by account
        '30010', // From number not verified
        '30011', // From number not owned by account
        '30012', // From number not verified
        '30013', // From number not owned by account
        '30014', // From number not verified
        '30015', // From number not owned by account
        '30016', // From number not verified
        '30017', // From number not owned by account
        '30018', // From number not verified
        '30019', // From number not owned by account
        '30020'  // From number not verified
      ];

      if (webhook.ErrorCode && retryableErrors.includes(webhook.ErrorCode)) {
        console.log(`Retryable error detected: ${webhook.ErrorCode}. Scheduling retry for message ${webhook.MessageSid}`);
        
        // Schedule retry with exponential backoff
        await this.scheduleRetry(webhook);
      } else {
        console.log(`Non-retryable error: ${webhook.ErrorCode}. Message ${webhook.MessageSid} will not be retried.`);
      }
    } catch (error) {
      console.error('Error handling retry logic:', error);
    }
  }

  private async scheduleRetry(webhook: TwilioStatusWebhook): Promise<void> {
    try {
      // Find the original notification
      const collection = this.db.collection('notificationQueue');
      const notification = await collection.findOne({ 'metadata.twilioMessageSid': webhook.MessageSid });

      if (notification && notification.retryCount < notification.maxRetries) {
        // Calculate retry delay (exponential backoff)
        const retryDelay = Math.min(
          Math.pow(2, notification.retryCount) * 60000, // Base: 1 minute, max: 8 minutes
          300000 // Cap at 5 minutes
        );

        const retryTime = new Date(Date.now() + retryDelay);

        await collection.updateOne(
          { _id: notification._id },
          {
            $set: {
              status: 'pending',
              scheduledTime: retryTime,
              updatedAt: new Date()
            },
            $inc: { retryCount: 1 },
            $push: {
              'metadata.retryHistory': {
                timestamp: new Date(),
                errorCode: webhook.ErrorCode,
                errorMessage: webhook.ErrorMessage,
                retryCount: notification.retryCount + 1
              }
            }
          }
        );

        console.log(`Retry scheduled for message ${webhook.MessageSid} at ${retryTime}`);
      } else {
        console.log(`Message ${webhook.MessageSid} has exceeded max retries or notification not found`);
      }
    } catch (error) {
      console.error('Error scheduling retry:', error);
    }
  }

  // Get delivery statistics for monitoring
  async getDeliveryStats(days: number = 7): Promise<{
    totalMessages: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    dailyStats: Array<{
      date: string;
      total: number;
      successful: number;
      failed: number;
      rate: number;
    }>;
  }> {
    try {
      const collection = this.db.collection('deliveryStats');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const stats = await collection.find({
        date: { $gte: cutoffDate.toISOString().split('T')[0] }
      }).sort({ date: 1 }).toArray();

      const totalMessages = stats.reduce((sum: number, stat: any) => sum + stat.totalMessages, 0);
      const successfulDeliveries = stats.reduce((sum: number, stat: any) => sum + stat.successfulDeliveries, 0);
      const failedDeliveries = stats.reduce((sum: number, stat: any) => sum + stat.failedDeliveries, 0);
      const successRate = totalMessages > 0 ? (successfulDeliveries / totalMessages) * 100 : 0;

      const dailyStats = stats.map((stat: any) => ({
        date: stat.date,
        total: stat.totalMessages,
        successful: stat.successfulDeliveries,
        failed: stat.failedDeliveries,
        rate: stat.totalMessages > 0 ? (stat.successfulDeliveries / stat.totalMessages) * 100 : 0
      }));

      return {
        totalMessages,
        successfulDeliveries,
        failedDeliveries,
        successRate,
        dailyStats
      };
    } catch (error) {
      console.error('Error getting delivery stats:', error);
      return {
        totalMessages: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        dailyStats: []
      };
    }
  }
}
