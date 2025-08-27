export interface TwilioInboundWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaUrl1?: string;
  MediaUrl2?: string;
  MediaUrl3?: string;
  MediaUrl4?: string;
  MediaUrl5?: string;
  MediaUrl6?: string;
  MediaUrl7?: string;
  MediaUrl8?: string;
  MediaUrl9?: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
  FromZip?: string;
  ToCity?: string;
  ToState?: string;
  ToCountry?: string;
  ToZip?: string;
  DateCreated?: string;
}

export interface InboundMessage {
  id: string;
  messageSid: string;
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  location?: {
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  timestamp: Date;
  processed: boolean;
  responseSent: boolean;
  responseMessage?: string;
  metadata: Record<string, any>;
}

export class TwilioInboundHandler {
  private db: any;
  private notificationQueue: any;
  private userPrefsManager: any;

  constructor(database: any, notificationQueue: any, userPrefsManager: any) {
    this.db = database;
    this.notificationQueue = notificationQueue;
    this.userPrefsManager = userPrefsManager;
  }

  async handleInboundMessage(webhook: TwilioInboundWebhook): Promise<void> {
    try {
      console.log(`Processing inbound message from ${webhook.From}: ${webhook.Body}`);

      // Store the inbound message
      const messageId = await this.storeInboundMessage(webhook);

      // Process the message content
      const response = await this.processMessage(webhook);

      // Send response if needed
      if (response) {
        await this.sendResponse(webhook.From, response);
        await this.markMessageResponded(messageId, response);
      }

      // Mark message as processed
      await this.markMessageProcessed(messageId);

    } catch (error) {
      console.error('Error handling inbound message:', error);
    }
  }

  private async storeInboundMessage(webhook: TwilioInboundWebhook): Promise<string> {
    try {
      const collection = this.db.collection('inboundMessages');
      
      const mediaUrls = this.extractMediaUrls(webhook);
      const location = this.extractLocation(webhook);

      const message: InboundMessage = {
        id: this.generateMessageId(),
        messageSid: webhook.MessageSid,
        from: webhook.From,
        to: webhook.To,
        body: webhook.Body,
        mediaUrls,
        location,
        timestamp: webhook.DateCreated ? new Date(webhook.DateCreated) : new Date(),
        processed: false,
        responseSent: false,
        metadata: {
          receivedAt: new Date(),
          webhookData: webhook
        }
      };

      await collection.insertOne(message);
      return message.id;

    } catch (error) {
      console.error('Error storing inbound message:', error);
      throw error;
    }
  }

  private extractMediaUrls(webhook: TwilioInboundWebhook): string[] {
    const mediaUrls: string[] = [];
    
    if (webhook.NumMedia && parseInt(webhook.NumMedia) > 0) {
      for (let i = 0; i < parseInt(webhook.NumMedia); i++) {
        const mediaUrl = (webhook as any)[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
        }
      }
    }

    return mediaUrls;
  }

  private extractLocation(webhook: TwilioInboundWebhook): {
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  } {
    return {
      city: webhook.FromCity,
      state: webhook.FromState,
      country: webhook.FromCountry,
      zip: webhook.FromZip
    } as {
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
    };
  }

  private async processMessage(webhook: TwilioInboundWebhook): Promise<string | null> {
    try {
      const message = webhook.Body.toLowerCase().trim();
      const fromNumber = webhook.From;

      // Check if this is a response to a ride update
      if (await this.isRideUpdateResponse(fromNumber)) {
        return this.handleRideUpdateResponse(message);
      }

      // Check if this is a help request
      if (this.isHelpRequest(message)) {
        return this.getHelpMessage();
      }

      // Check if this is a status request
      if (this.isStatusRequest(message)) {
        return await this.getRideStatus(fromNumber);
      }

      // Check if this is a cancellation request
      if (this.isCancellationRequest(message)) {
        return await this.handleCancellationRequest(fromNumber);
      }

      // Check if this is an emergency message
      if (this.isEmergencyMessage(message)) {
        return await this.handleEmergencyMessage(message, fromNumber);
      }

      // Default response for unrecognized messages
      return this.getDefaultResponse();

    } catch (error) {
      console.error('Error processing message:', error);
      return 'Sorry, I encountered an error processing your message. Please try again or contact support.';
    }
  }

  private async isRideUpdateResponse(fromNumber: string): Promise<boolean> {
    try {
      // Check if user has any active rides
      const collection = this.db.collection('rideRequests');
      const activeRide = await collection.findOne({
        userId: fromNumber,
        status: { $in: ['assigned', 'accepted', 'in-progress'] }
      });

      return !!activeRide;
    } catch (error) {
      console.error('Error checking ride update response:', error);
      return false;
    }
  }

  private handleRideUpdateResponse(message: string): string {
    const responses = {
      'yes': 'Great! I\'ll confirm your acceptance. Your driver will be notified.',
      'no': 'I\'ll cancel this ride request for you. A new driver will be assigned.',
      'ok': 'Thank you for confirming. Your ride is confirmed.',
      'confirm': 'Ride confirmed! Your driver will arrive as scheduled.',
      'cancel': 'I\'ll cancel this ride request for you.',
      'ready': 'Perfect! I\'ll let your driver know you\'re ready.',
      'not ready': 'No problem! I\'ll let your driver know you need more time.',
      'arrived': 'Great! I\'ll mark you as arrived at your destination.',
      'help': 'I\'m here to help! You can:\n- Reply YES/NO to accept/decline rides\n- Reply READY when you\'re ready for pickup\n- Reply ARRIVED when you reach your destination\n- Reply HELP for more options'
    };

    for (const [key, response] of Object.entries(responses)) {
      if (message.includes(key)) {
        return response;
      }
    }

    return 'I didn\'t understand that response. Please reply with YES, NO, READY, ARRIVED, or HELP.';
  }

  private isHelpRequest(message: string): boolean {
    const helpKeywords = ['help', 'h', '?', 'what', 'how', 'options', 'menu'];
    return helpKeywords.some(keyword => message.includes(keyword));
  }

  private getHelpMessage(): string {
    return `🚗 Ride Service Help

Available commands:
• HELP - Show this message
• STATUS - Check your ride status
• CANCEL - Cancel current ride
• READY - Tell driver you're ready
• ARRIVED - Confirm arrival

For emergencies, reply with URGENT or call 911.

Need more help? Contact our support team.`;
  }

  private isStatusRequest(message: string): boolean {
    const statusKeywords = ['status', 'where', 'when', 'eta', 'update'];
    return statusKeywords.some(keyword => message.includes(keyword));
  }

  private async getRideStatus(fromNumber: string): Promise<string> {
    try {
      const collection = this.db.collection('rideRequests');
      const activeRide = await collection.findOne({
        userId: fromNumber,
        status: { $in: ['pending', 'assigned', 'accepted', 'in-progress'] }
      });

      if (!activeRide) {
        return 'You don\'t have any active rides at the moment.';
      }

      const statusMessages = {
        'pending': 'Your ride request is being processed. We\'ll assign a driver soon.',
        'assigned': `Driver assigned! ${activeRide.driverName || 'Your driver'} will arrive at ${activeRide.pickupTime || 'the scheduled time'}.`,
        'accepted': `Ride confirmed! ${activeRide.driverName || 'Your driver'} is on the way.`,
        'in-progress': `You\'re currently on your ride with ${activeRide.driverName || 'your driver'}. ETA: ${activeRide.eta || 'calculating...'}`
      };

      return statusMessages[activeRide.status as keyof typeof statusMessages] || 'Ride status unknown.';
    } catch (error) {
      console.error('Error getting ride status:', error);
      return 'Sorry, I couldn\'t retrieve your ride status. Please try again.';
    }
  }

  private isCancellationRequest(message: string): boolean {
    const cancelKeywords = ['cancel', 'stop', 'no', 'nevermind', 'forget'];
    return cancelKeywords.some(keyword => message.includes(keyword));
  }

  private async handleCancellationRequest(fromNumber: string): Promise<string> {
    try {
      const collection = this.db.collection('rideRequests');
      const activeRide = await collection.findOne({
        userId: fromNumber,
        status: { $in: ['pending', 'assigned', 'accepted'] }
      });

      if (!activeRide) {
        return 'You don\'t have any rides to cancel.';
      }

      // Update ride status
      await collection.updateOne(
        { _id: activeRide._id },
        { 
          $set: { 
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: 'user_sms'
          }
        }
      );

      // Notify driver if assigned
      if (activeRide.providerId) {
        await this.notificationQueue.addRideUpdateNotification(
          activeRide.providerId,
          activeRide.id,
          'Ride has been cancelled by the passenger.',
          'high'
        );
      }

      return 'Your ride has been cancelled successfully.';
    } catch (error) {
      console.error('Error handling cancellation request:', error);
      return 'Sorry, I couldn\'t cancel your ride. Please try again or contact support.';
    }
  }

  private isEmergencyMessage(message: string): boolean {
    const emergencyKeywords = ['emergency', 'urgent', 'help', '911', 'danger', 'accident', 'medical'];
    return emergencyKeywords.some(keyword => message.includes(keyword));
  }

  private async handleEmergencyMessage(message: string, fromNumber: string): Promise<string> {
    try {
      // Log emergency message
      const collection = this.db.collection('emergencyAlerts');
      await collection.insertOne({
        userId: fromNumber,
        message,
        timestamp: new Date(),
        status: 'active',
        priority: 'urgent'
      });

      // Get user preferences for emergency contacts
      const userPrefs = await this.userPrefsManager.getUserPreferences(fromNumber);
      
      // Notify emergency contacts if available
      if (userPrefs?.emergencyContact) {
        await this.notificationQueue.addEmergencyNotification(
          userPrefs.emergencyContact.phoneNumber,
          `EMERGENCY ALERT: ${userPrefs.emergencyContact.relationship} has sent an emergency message: "${message}". Please respond immediately.`
        );
      }

      // Notify support team
      await this.notifySupportTeam(fromNumber, message);

      return '🚨 EMERGENCY ALERT RECEIVED! I\'ve notified emergency contacts and support team. If this is life-threatening, please call 911 immediately.';
    } catch (error) {
      console.error('Error handling emergency message:', error);
      return '🚨 EMERGENCY ALERT RECEIVED! Please call 911 if this is life-threatening.';
    }
  }

  private async notifySupportTeam(fromNumber: string, message: string): Promise<void> {
    try {
      // Add notification for support team
      await this.notificationQueue.addEmergencyNotification(
        'support', // This would be a support team number
        `EMERGENCY: User ${fromNumber} sent: "${message}"`
      );
    } catch (error) {
      console.error('Error notifying support team:', error);
    }
  }

  private getDefaultResponse(): string {
    return `I didn't understand that message. 

Reply with:
• HELP for available commands
• STATUS to check your ride
• READY when you're ready for pickup
• CANCEL to cancel your ride

For emergencies, reply with URGENT or call 911.`;
  }

  private async sendResponse(to: string, message: string): Promise<void> {
    try {
      // Add response to notification queue
      await this.notificationQueue.addSMSNotification(
        to,
        message,
        'high'
      );

      console.log(`Response queued for ${to}: ${message}`);
    } catch (error) {
      console.error('Error sending response:', error);
    }
  }

  private async markMessageProcessed(messageId: string): Promise<void> {
    try {
      const collection = this.db.collection('inboundMessages');
      await collection.updateOne(
        { id: messageId },
        { $set: { processed: true } }
      );
    } catch (error) {
      console.error('Error marking message as processed:', error);
    }
  }

  private async markMessageResponded(messageId: string, response: string): Promise<void> {
    try {
      const collection = this.db.collection('inboundMessages');
      await collection.updateOne(
        { id: messageId },
        { 
          $set: { 
            responseSent: true,
            responseMessage: response
          } 
        }
      );
    } catch (error) {
      console.error('Error marking message as responded:', error);
    }
  }

  private generateMessageId(): string {
    return `inbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get inbound message statistics
  async getInboundStats(days: number = 7): Promise<{
    totalMessages: number;
    processedMessages: number;
    respondedMessages: number;
    responseRate: number;
    dailyStats: Array<{
      date: string;
      total: number;
      processed: number;
      responded: number;
    }>;
  }> {
    try {
      const collection = this.db.collection('inboundMessages');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const messages = await collection.find({
        timestamp: { $gte: cutoffDate }
      }).toArray();

      const totalMessages = messages.length;
      const processedMessages = messages.filter((m: any) => m.processed).length;
      const respondedMessages = messages.filter((m: any) => m.responseSent).length;
      const responseRate = totalMessages > 0 ? (respondedMessages / totalMessages) * 100 : 0;

      // Group by date
      const dailyStats = this.groupMessagesByDate(messages);

      return {
        totalMessages,
        processedMessages,
        respondedMessages,
        responseRate,
        dailyStats
      };
    } catch (error) {
      console.error('Error getting inbound stats:', error);
      return {
        totalMessages: 0,
        processedMessages: 0,
        respondedMessages: 0,
        responseRate: 0,
        dailyStats: []
      };
    }
  }

  private groupMessagesByDate(messages: any[]): Array<{
    date: string;
    total: number;
    processed: number;
    responded: number;
  }> {
    const dailyStats = new Map<string, { total: number; processed: number; responded: number }>();

    messages.forEach(message => {
      const date = message.timestamp.toISOString().split('T')[0];
      
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { total: 0, processed: 0, responded: 0 });
      }

      const stats = dailyStats.get(date)!;
      stats.total++;
      
      if (message.processed) stats.processed++;
      if (message.responseSent) stats.responded++;
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      ...stats
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
}
