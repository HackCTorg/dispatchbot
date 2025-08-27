export interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ride-updates' | 'reminders' | 'emergency' | 'general';
  language: 'en' | 'es' | 'fr';
  template: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

export class MessageTemplateManager {
  private db: any;
  private defaultTemplates: Map<string, MessageTemplate>;

  constructor(database: any) {
    this.db = database;
    this.defaultTemplates = new Map();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    // English templates
    this.defaultTemplates.set('en_ride_confirmation', {
      id: 'en_ride_confirmation',
      name: 'Ride Request Confirmation',
      description: 'Sent when a ride request is first received',
      category: 'ride-updates',
      language: 'en',
      template: 'Your ride request has been received! We\'ll notify you when a driver is assigned. Request ID: {rideId}',
      variables: ['rideId'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_provider_assigned', {
      id: 'en_provider_assigned',
      name: 'Provider Assigned',
      description: 'Sent when a service provider is assigned to a ride',
      category: 'ride-updates',
      language: 'en',
      template: 'Great news! Driver {driverName} has been assigned to your ride. They\'ll arrive at {pickupTime}. Driver phone: {driverPhone}',
      variables: ['driverName', 'pickupTime', 'driverPhone'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_driver_arrived', {
      id: 'en_driver_arrived',
      name: 'Driver Arrived',
      description: 'Sent when the driver arrives at pickup location',
      category: 'ride-updates',
      language: 'en',
      template: 'Your driver {driverName} has arrived at your pickup location. Please come outside when ready.',
      variables: ['driverName'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_ride_started', {
      id: 'en_ride_started',
      name: 'Ride Started',
      description: 'Sent when the ride begins',
      category: 'ride-updates',
      language: 'en',
      template: 'Your ride has begun! Estimated arrival time: {eta}. If you need anything, call {driverPhone}.',
      variables: ['eta', 'driverPhone'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_ride_completed', {
      id: 'en_ride_completed',
      name: 'Ride Completed',
      description: 'Sent when the ride is completed',
      category: 'ride-updates',
      language: 'en',
      template: 'Your ride has been completed. Thank you for using our service! Please rate your experience.',
      variables: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_ride_cancelled', {
      id: 'en_ride_cancelled',
      name: 'Ride Cancelled',
      description: 'Sent when a ride is cancelled',
      category: 'ride-updates',
      language: 'en',
      template: 'Your ride scheduled for {pickupTime} has been cancelled. Please request a new ride if needed.',
      variables: ['pickupTime'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_delay_notification', {
      id: 'en_delay_notification',
      name: 'Delay Notification',
      description: 'Sent when there\'s a delay in pickup or arrival',
      category: 'ride-updates',
      language: 'en',
      template: 'We\'re experiencing a delay. Your driver will arrive approximately {delayMinutes} minutes late. We apologize for the inconvenience.',
      variables: ['delayMinutes'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_emergency_alert', {
      id: 'en_emergency_alert',
      name: 'Emergency Alert',
      description: 'Sent for emergency situations',
      category: 'emergency',
      language: 'en',
      template: '🚨 EMERGENCY: {message}. Please call 911 if this is a life-threatening emergency.',
      variables: ['message'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.defaultTemplates.set('en_pickup_reminder', {
      id: 'en_pickup_reminder',
      name: 'Pickup Reminder',
      description: 'Sent as a reminder before pickup time',
      category: 'reminders',
      language: 'en',
      template: 'Reminder: Your ride is scheduled for {pickupTime}. Please be ready at {pickupLocation}.',
      variables: ['pickupTime', 'pickupLocation'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Spanish templates
    this.defaultTemplates.set('es_ride_confirmation', {
      id: 'es_ride_confirmation',
      name: 'Confirmación de Solicitud de Viaje',
      description: 'Enviado cuando se recibe una solicitud de viaje',
      category: 'ride-updates',
      language: 'es',
      template: '¡Su solicitud de viaje ha sido recibida! Le notificaremos cuando se asigne un conductor. ID de solicitud: {rideId}',
      variables: ['rideId'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // French templates
    this.defaultTemplates.set('fr_ride_confirmation', {
      id: 'fr_ride_confirmation',
      name: 'Confirmation de Demande de Course',
      description: 'Envoyé lorsqu\'une demande de course est reçue',
      category: 'ride-updates',
      language: 'fr',
      template: 'Votre demande de course a été reçue ! Nous vous notifierons quand un chauffeur sera assigné. ID de demande : {rideId}',
      variables: ['rideId'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async initializeTemplates(): Promise<void> {
    try {
      const collection = this.db.collection('messageTemplates');
      
      // Check if templates already exist
      const existingCount = await collection.countDocuments();
      
      if (existingCount === 0) {
        // Insert default templates
        const templates = Array.from(this.defaultTemplates.values());
        await collection.insertMany(templates);
        console.log(`Initialized ${templates.length} default message templates`);
      }
    } catch (error) {
      console.error('Error initializing message templates:', error);
    }
  }

  async getTemplate(templateId: string): Promise<MessageTemplate | null> {
    try {
      const collection = this.db.collection('messageTemplates');
      return await collection.findOne({ id: templateId });
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  async getTemplatesByCategory(category: string, language: string = 'en'): Promise<MessageTemplate[]> {
    try {
      const collection = this.db.collection('messageTemplates');
      return await collection.find({ 
        category, 
        language, 
        isActive: true 
      }).toArray();
    } catch (error) {
      console.error('Error fetching templates by category:', error);
      return [];
    }
  }

  async getTemplatesByLanguage(language: string): Promise<MessageTemplate[]> {
    try {
      const collection = this.db.collection('messageTemplates');
      return await collection.find({ 
        language, 
        isActive: true 
      }).toArray();
    } catch (error) {
      console.error('Error fetching templates by language:', error);
      return [];
    }
  }

  async createTemplate(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('messageTemplates');
      const newTemplate: MessageTemplate = {
        ...template,
        id: this.generateTemplateId(template.language, template.name),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newTemplate);
      return newTemplate.id;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  async updateTemplate(templateId: string, updates: Partial<MessageTemplate>): Promise<boolean> {
    try {
      const collection = this.db.collection('messageTemplates');
      const result = await collection.updateOne(
        { id: templateId },
        { 
          $set: { 
            ...updates, 
            updatedAt: new Date() 
          } 
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating template:', error);
      return false;
    }
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('messageTemplates');
      const result = await collection.deleteOne({ id: templateId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  async formatMessage(templateId: string, variables: Record<string, any>): Promise<string | null> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) return null;

      let message = template.template;
      
      // Replace variables in template
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        message = message.replace(new RegExp(placeholder, 'g'), String(value));
      }

      return message;
    } catch (error) {
      console.error('Error formatting message:', error);
      return null;
    }
  }

  async validateTemplate(template: string, variables: string[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unmatched variables
    const usedVariables = template.match(/\{(\w+)\}/g)?.map(v => v.slice(1, -1)) || [];
    const declaredVariables = new Set(variables);

    for (const usedVar of usedVariables) {
      if (!declaredVariables.has(usedVar)) {
        errors.push(`Variable '${usedVar}' is used but not declared`);
      }
    }

    for (const declaredVar of declaredVariables) {
      if (!usedVariables.includes(declaredVar)) {
        warnings.push(`Variable '${declaredVar}' is declared but not used`);
      }
    }

    // Check template length
    if (template.length > 1600) {
      warnings.push('Template is longer than recommended SMS length (1600 characters)');
    }

    // Check for required variables
    if (variables.length === 0) {
      warnings.push('No variables declared - template may be too generic');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private generateTemplateId(language: string, name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${language}_${name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`;
  }

  // Get available template variables for the system
  getAvailableVariables(): TemplateVariable[] {
    return [
      {
        name: 'rideId',
        description: 'Unique identifier for the ride request',
        example: 'RIDE_12345',
        required: false
      },
      {
        name: 'driverName',
        description: 'Name of the assigned driver',
        example: 'John Smith',
        required: false
      },
      {
        name: 'driverPhone',
        description: 'Phone number of the assigned driver',
        example: '+1234567890',
        required: false
      },
      {
        name: 'pickupTime',
        description: 'Scheduled pickup time',
        example: '2:30 PM',
        required: false
      },
      {
        name: 'pickupLocation',
        description: 'Pickup address or location',
        example: '123 Main St, City, State',
        required: false
      },
      {
        name: 'dropoffLocation',
        description: 'Dropoff address or location',
        example: '456 Oak Ave, City, State',
        required: false
      },
      {
        name: 'eta',
        description: 'Estimated time of arrival',
        example: '3:15 PM',
        required: false
      },
      {
        name: 'delayMinutes',
        description: 'Number of minutes delayed',
        example: '15',
        required: false
      },
      {
        name: 'message',
        description: 'Custom message content',
        example: 'Driver is running late due to traffic',
        required: false
      },
      {
        name: 'userName',
        description: 'Name of the ride requester',
        example: 'Jane Doe',
        required: false
      }
    ];
  }
}
