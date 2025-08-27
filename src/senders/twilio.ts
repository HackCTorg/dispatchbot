import { Twilio } from 'twilio';
import { NotificationItem } from '../queues/notifyQueue';
import { UserPrefsManager } from '../prefs/userPrefs';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  webhookUrl?: string;
}

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string[];
  statusCallback?: string;
}

export class TwilioSender {
  private client: Twilio;
  private config: TwilioConfig;
  private userPrefs: UserPrefsManager;
  private messageTemplates: Map<string, string>;

  constructor(config: TwilioConfig, userPrefs: UserPrefsManager) {
    this.config = config;
    this.userPrefs = userPrefs;
    this.client = new Twilio(config.accountSid, config.authToken);
    this.messageTemplates = new Map();
    this.initializeTemplates();
  }

  private initializeTemplates() {
    // Default message templates for common ride updates
    this.messageTemplates.set('rideRequestConfirmation', 
      'Your ride request has been received! We\'ll notify you when a driver is assigned. Request ID: {rideId}'
    );
    
    this.messageTemplates.set('providerAssigned', 
      'Great news! Driver {driverName} has been assigned to your ride. They\'ll arrive at {pickupTime}. Driver phone: {driverPhone}'
    );
    
    this.messageTemplates.set('driverArrived', 
      'Your driver {driverName} has arrived at your pickup location. Please come outside when ready.'
    );
    
    this.messageTemplates.set('rideStarted', 
      'Your ride has begun! Estimated arrival time: {eta}. If you need anything, call {driverPhone}.'
    );
    
    this.messageTemplates.set('rideCompleted', 
      'Your ride has been completed. Thank you for using our service! Please rate your experience.'
    );
    
    this.messageTemplates.set('rideCancelled', 
      'Your ride scheduled for {pickupTime} has been cancelled. Please request a new ride if needed.'
    );
    
    this.messageTemplates.set('delayNotification', 
      'We\'re experiencing a delay. Your driver will arrive approximately {delayMinutes} minutes late. We apologize for the inconvenience.'
    );
    
    this.messageTemplates.set('emergencyAlert', 
      'EMERGENCY: {message}. Please call 911 if this is a life-threatening emergency.'
    );
    
    this.messageTemplates.set('reminder', 
      'Reminder: Your ride is scheduled for {pickupTime}. Please be ready at {pickupLocation}.'
    );
  }

  async sendSMS(notification: NotificationItem): Promise<boolean> {
    try {
      // Get user preferences to check if SMS is enabled
      const userPrefs = await this.userPrefs.getUserPreferences(notification.recipient);
      
      if (userPrefs && !userPrefs.notificationPreferences.sms) {
        console.log(`SMS disabled for user ${notification.recipient}`);
        return true; // Mark as "sent" since it was intentionally not sent
      }

      // Format message based on template if available
      let messageBody = notification.message;
      if (notification.metadata['templateKey']) {
        const template = this.messageTemplates.get(notification.metadata['templateKey']);
        if (template) {
          messageBody = this.formatTemplate(template, notification.metadata['templateData'] || {});
        }
      }

      // Send SMS via Twilio
      const message = await this.client.messages.create({
        body: messageBody,
        from: this.config.fromNumber,
        to: notification.recipient,
        statusCallback: this.config.webhookUrl || ''
      });

      console.log(`SMS sent successfully: ${message.sid} to ${notification.recipient}`);
      return true;

    } catch (error) {
      console.error(`Error sending SMS to ${notification.recipient}:`, error);
      return false;
    }
  }

  async sendRideUpdateSMS(
    phoneNumber: string, 
    templateKey: string, 
    templateData: Record<string, any> = {},
    _priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<string> {
    const template = this.messageTemplates.get(templateKey);
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    const message = this.formatTemplate(template, templateData);
    
    const smsMessage: SMSMessage = {
      to: phoneNumber,
      body: message,
      from: this.config.fromNumber
    };

    try {
      const result = await this.client.messages.create(smsMessage);
      console.log(`Ride update SMS sent: ${result.sid}`);
      return result.sid;
    } catch (error) {
      console.error('Error sending ride update SMS:', error);
      throw error;
    }
  }

  async sendEmergencySMS(phoneNumber: string, message: string): Promise<string> {
    const emergencyMessage: SMSMessage = {
      to: phoneNumber,
      body: `🚨 EMERGENCY: ${message}`,
      from: this.config.fromNumber
    };

    try {
      const result = await this.client.messages.create(emergencyMessage);
      console.log(`Emergency SMS sent: ${result.sid}`);
      return result.sid;
    } catch (error) {
      console.error('Error sending emergency SMS:', error);
      throw error;
    }
  }

  async sendBulkSMS(notifications: NotificationItem[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ notificationId: string; error: string }>;
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ notificationId: string; error: string }>
    };

    // Process notifications in batches to avoid overwhelming Twilio
    const batchSize = 10;
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (notification) => {
        try {
          const success = await this.sendSMS(notification);
          if (success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push({
              notificationId: notification.id,
              error: 'SMS sending failed'
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            notificationId: notification.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to be respectful to Twilio
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async getMessageStatus(messageSid: string): Promise<any> {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        direction: message.direction,
        from: message.from,
        to: message.to,
        body: message.body,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      throw error;
    }
  }

  async getAccountUsage(): Promise<{
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
  }> {
    try {
      const messages = await this.client.messages.list({ limit: 1000 });

      const messagesSent = messages.length;
      const messagesDelivered = messages.filter((m: any) => m.status === 'delivered').length;
      const messagesFailed = messages.filter((m: any) => m.status === 'failed').length;

      return {
        messagesSent,
        messagesDelivered,
        messagesFailed
      };
    } catch (error) {
      console.error('Error fetching account usage:', error);
      throw error;
    }
  }

  private formatTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  // Method to add custom message templates
  addMessageTemplate(key: string, template: string): void {
    this.messageTemplates.set(key, template);
  }

  // Method to get all available templates
  getMessageTemplates(): Map<string, string> {
    return new Map(this.messageTemplates);
  }
}
