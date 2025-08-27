export interface NotificationItem {
  id: string;
  type: 'sms' | 'email' | 'push';
  recipient: string; // phone number, email, or user UUID
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledTime?: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueConfig {
  maxConcurrent: number;
  retryDelays: number[]; // delays in milliseconds
  maxRetries: number;
  batchSize: number;
  processInterval: number; // milliseconds
}

export class NotificationQueue {
  private db: any;
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private processingCount: number = 0;

  constructor(database: any, config: Partial<QueueConfig> = {}) {
    this.db = database;
    this.config = {
      maxConcurrent: 5,
      retryDelays: [1000, 5000, 15000, 60000], // 1s, 5s, 15s, 1m
      maxRetries: 3,
      batchSize: 10,
      processInterval: 1000, // 1 second
      ...config
    };
  }

  async addNotification(notification: Omit<NotificationItem, 'id' | 'retryCount' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notificationQueue');
      const newNotification: NotificationItem = {
        ...notification,
        id: this.generateNotificationId(),
        retryCount: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newNotification);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return newNotification.id;
    } catch (error) {
      console.error('Error adding notification to queue:', error);
      throw error;
    }
  }

  async addSMSNotification(phoneNumber: string, message: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium', metadata: Record<string, any> = {}): Promise<string> {
    return this.addNotification({
      type: 'sms',
      recipient: phoneNumber,
      message,
      priority,
      maxRetries: this.config.maxRetries,
      metadata
    });
  }

  async addRideUpdateNotification(serviceUserUuid: string, rideRequestUuid: string, message: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<string> {
    return this.addNotification({
      type: 'sms',
      recipient: serviceUserUuid,
      message,
      priority,
      maxRetries: this.config.maxRetries,
      metadata: { rideRequestUuid, notificationType: 'rideUpdate' }
    });
  }

  async addDriverNotification(driverUuid: string, rideRequestUuid: string, message: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<string> {
    return this.addNotification({
      type: 'sms',
      recipient: driverUuid,
      message,
      priority,
      maxRetries: this.config.maxRetries,
      metadata: { rideRequestUuid, notificationType: 'driverUpdate' }
    });
  }

  async addEmergencyNotification(recipient: string, message: string, metadata: Record<string, any> = {}): Promise<string> {
    return this.addNotification({
      type: 'sms',
      recipient,
      message,
      priority: 'urgent',
      maxRetries: this.config.maxRetries,
      metadata: { ...metadata, notificationType: 'emergency' }
    });
  }

  async addRoundtripNotification(serviceUserUuid: string, rideRequestUuid: string, message: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<string> {
    return this.addNotification({
      type: 'sms',
      recipient: serviceUserUuid,
      message,
      priority,
      maxRetries: this.config.maxRetries,
      metadata: { rideRequestUuid, notificationType: 'roundtripUpdate' }
    });
  }

  async addPickupReminder(serviceUserUuid: string, rideRequestUuid: string, pickupTime: Date, pickupAddress: string): Promise<string> {
    const message = `Reminder: Your ride is scheduled for pickup at ${pickupTime.toLocaleTimeString()} from ${pickupAddress}. Please be ready.`;
    
    return this.addNotification({
      type: 'sms',
      recipient: serviceUserUuid,
      message,
      priority: 'medium',
      maxRetries: this.config.maxRetries,
      scheduledTime: new Date(pickupTime.getTime() - 15 * 60 * 1000), // 15 minutes before
      metadata: { 
        rideRequestUuid, 
        notificationType: 'pickupReminder',
        pickupTime,
        pickupAddress
      }
    });
  }

  async addDelayNotification(serviceUserUuid: string, rideRequestUuid: string, delayMinutes: number, reason?: string): Promise<string> {
    const message = `We're experiencing a delay. Your driver will arrive approximately ${delayMinutes} minutes late. ${reason ? `Reason: ${reason}` : ''} We apologize for the inconvenience.`;
    
    return this.addNotification({
      type: 'sms',
      recipient: serviceUserUuid,
      message,
      priority: 'high',
      maxRetries: this.config.maxRetries,
      metadata: { 
        rideRequestUuid, 
        notificationType: 'delayNotification',
        delayMinutes,
        reason
      }
    });
  }

  async addStatusUpdateNotification(serviceUserUuid: string, rideRequestUuid: string, status: string, additionalInfo?: string): Promise<string> {
    const statusMessages: Record<string, string> = {
      'confirmed': 'Your ride request has been confirmed! A driver will be assigned soon.',
      'driver_assigned': 'Great news! A driver has been assigned to your ride.',
      'ride_started': 'Your ride has begun! You\'re on your way to your destination.',
      'pickup_complete': 'You have been picked up successfully.',
      'dropoff_complete': 'You have arrived at your destination. Thank you for using our service!',
      'roundtrip_returning': 'Your return trip has begun. You\'re heading back to your pickup location.',
      'roundtrip_complete': 'Your roundtrip has been completed. Thank you for using our service!',
      'cancelled': 'Your ride has been cancelled. Please request a new ride if needed.',
      'interrupted': 'Your ride has been interrupted. We\'ll contact you shortly with updates.'
    };

    const message = statusMessages[status] || `Your ride status has been updated: ${status}. ${additionalInfo || ''}`;
    
    return this.addNotification({
      type: 'sms',
      recipient: serviceUserUuid,
      message,
      priority: 'medium',
      maxRetries: this.config.maxRetries,
      metadata: { 
        rideRequestUuid, 
        notificationType: 'statusUpdate',
        status,
        additionalInfo
      }
    });
  }

  async getPendingNotifications(limit: number = this.config.batchSize): Promise<NotificationItem[]> {
    try {
      const collection = this.db.collection('notificationQueue');
      return await collection.find({
        status: 'pending',
        $or: [
          { scheduledTime: { $exists: false } },
          { scheduledTime: { $lte: new Date() } }
        ]
      })
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit)
      .toArray();
    } catch (error) {
      console.error('Error fetching pending notifications:', error);
      return [];
    }
  }

  async getProcessingNotifications(limit: number = this.config.batchSize): Promise<NotificationItem[]> {
    try {
      const collection = this.db.collection('notificationQueue');
      return await collection.find({ status: 'processing' })
        .sort({ priority: -1, createdAt: 1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Error fetching processing notifications:', error);
      return [];
    }
  }

  async markNotificationProcessing(id: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notificationQueue');
      const result = await collection.updateOne(
        { id, status: 'pending' },
        { 
          $set: { 
            status: 'processing',
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking notification as processing:', error);
      return false;
    }
  }

  async markNotificationSent(id: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notificationQueue');
      const result = await collection.updateOne(
        { id },
        { 
          $set: { 
            status: 'sent',
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking notification as sent:', error);
      return false;
    }
  }

  async markNotificationFailed(id: string, error: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notificationQueue');
      const notification = await collection.findOne({ id });
      
      if (!notification) return false;

      const shouldRetry = notification.retryCount < this.config.maxRetries;
      const newStatus = shouldRetry ? 'pending' : 'failed';
      const retryDelay = shouldRetry ? this.config.retryDelays[notification.retryCount] || 60000 : 0;
      const scheduledTime = shouldRetry ? new Date(Date.now() + retryDelay) : undefined;

      const result = await collection.updateOne(
        { id },
        { 
          $set: { 
            status: newStatus,
            retryCount: notification.retryCount + 1,
            scheduledTime,
            updatedAt: new Date()
          },
          $push: {
            'metadata.errors': {
              timestamp: new Date(),
              error,
              retryCount: notification.retryCount + 1
            }
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error marking notification as failed:', error);
      return false;
    }
  }

  async cancelNotification(id: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notificationQueue');
      const result = await collection.updateOne(
        { id },
        { 
          $set: { 
            status: 'cancelled',
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error cancelling notification:', error);
      return false;
    }
  }

  async cancelRideNotifications(rideRequestUuid: string): Promise<number> {
    try {
      const collection = this.db.collection('notificationQueue');
      const result = await collection.updateMany(
        { 
          'metadata.rideRequestUuid': rideRequestUuid,
          status: { $in: ['pending', 'processing'] }
        },
        { 
          $set: { 
            status: 'cancelled',
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cancelling ride notifications:', error);
      return 0;
    }
  }

  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    try {
      const collection = this.db.collection('notificationQueue');
      const pipeline = [
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ];

      const results = await collection.aggregate(pipeline).toArray();
      const stats = {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        total: 0
      };

      results.forEach((result: any) => {
        stats[result._id as keyof typeof stats] = result.count;
        stats.total += result.count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return { pending: 0, processing: 0, sent: 0, failed: 0, total: 0 };
    }
  }

  async getRideNotificationStats(rideRequestUuid: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    cancelled: number;
  }> {
    try {
      const collection = this.db.collection('notificationQueue');
      const pipeline = [
        {
          $match: { 'metadata.rideRequestUuid': rideRequestUuid }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ];

      const results = await collection.aggregate(pipeline).toArray();
      const stats = {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        cancelled: 0
      };

      results.forEach((result: any) => {
        stats[result._id as keyof typeof stats] = result.count;
        stats.total += result.count;
      });

      return stats;
    } catch (error) {
      console.error('Error getting ride notification stats:', error);
      return { total: 0, sent: 0, failed: 0, pending: 0, cancelled: 0 };
    }
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('Starting notification queue processing...');

    while (this.isProcessing) {
      try {
        if (this.processingCount < this.config.maxConcurrent) {
          const notifications = await this.getPendingNotifications();
          
          for (const notification of notifications) {
            if (this.processingCount >= this.config.maxConcurrent) break;
            
            this.processNotification(notification);
          }
        }

        await new Promise(resolve => setTimeout(resolve, this.config.processInterval));
      } catch (error) {
        console.error('Error in notification queue processing:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
      }
    }
  }

  private async processNotification(notification: NotificationItem): Promise<void> {
    this.processingCount++;
    
    try {
      const success = await this.markNotificationProcessing(notification.id);
      if (!success) {
        this.processingCount--;
        return;
      }

      // This will be handled by the notification sender
      // The actual sending logic is in the Twilio sender
      console.log(`Processing notification ${notification.id} to ${notification.recipient}`);
      
    } catch (error) {
      console.error(`Error processing notification ${notification.id}:`, error);
      await this.markNotificationFailed(notification.id, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.processingCount--;
    }
  }

  stopProcessing(): void {
    this.isProcessing = false;
    console.log('Stopping notification queue processing...');
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
