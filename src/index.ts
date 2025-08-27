import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { RideEventManager, RideEventType } from './events/rideEvents';
import { NotificationQueue } from './queues/notifyQueue';
import { TwilioConfig, TwilioSender } from './senders/twilio';
import { UserPrefsManager } from './prefs/userPrefs';

// Load environment variables
dotenv.config();

export class DispatchBot {
  private app: express.Application;
  private db!: MongoClient;
  private rideEventManager!: RideEventManager;
  private notificationQueue!: NotificationQueue;
  private twilioSender!: TwilioSender;
  private userPrefsManager!: UserPrefsManager;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env['PORT'] || '3000');
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for web app integration
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Emergency notification endpoint (still needed for manual emergency alerts)
    this.app.post('/api/notifications/emergency', this.sendEmergencyNotification.bind(this));
    
    // Queue status monitoring
    this.app.get('/api/notifications/queue/status', this.getQueueStatus.bind(this));
    
    // User preferences management (still needed for setup)
    this.app.get('/api/users/:uuid/preferences', this.getUserPreferences.bind(this));
    this.app.put('/api/users/:uuid/preferences', this.updateUserPreferences.bind(this));
    
    // Driver preferences management (still needed for setup)
    this.app.get('/api/drivers/:uuid/preferences', this.getDriverPreferences.bind(this));
    this.app.put('/api/drivers/:uuid/preferences', this.updateDriverPreferences.bind(this));
    
    // DispatchBot status and control
    this.app.get('/api/dispatchbot/status', this.getDispatchBotStatus.bind(this));
    
    // Twilio webhook endpoints (still needed for SMS delivery status)
    this.app.post('/webhooks/twilio/status', this.handleTwilioStatus.bind(this));
    this.app.post('/webhooks/twilio/inbound', this.handleTwilioInbound.bind(this));
  }

  async initialize() {
    try {
      // Connect to MongoDB - Use the SAME database as your ride request app
      const mongoUri = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/ride-request-app';
      this.db = new MongoClient(mongoUri, {
        retryWrites: true,
        w: 'majority',
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000
      });
      await this.db.connect();
      console.log('Connected to MongoDB (same database as your ride request app)');

      // Initialize managers
      this.userPrefsManager = new UserPrefsManager(this.db.db());
      this.rideEventManager = new RideEventManager(this.db.db());
      this.notificationQueue = new NotificationQueue(this.db.db());

      // Initialize Twilio sender
      const twilioConfig = {
        accountSid: process.env['TWILIO_ACCOUNT_SID']!,
        authToken: process.env['TWILIO_AUTH_TOKEN']!,
        fromNumber: process.env['TWILIO_FROM_NUMBER']!,
        webhookUrl: process.env['TWILIO_WEBHOOK_URL']
      } as TwilioConfig;
      this.twilioSender = new TwilioSender(twilioConfig, this.userPrefsManager);

      // Set up automatic database change detection
      this.setupDatabaseChangeDetection();

      // Set up event handlers
      this.setupEventHandlers();

      // Set up scheduled tasks
      this.setupScheduledTasks();

      console.log('DispatchBot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DispatchBot:', error);
      throw error;
    }
  }

  // NEW: Automatic database change detection using MongoDB Change Streams
  private setupDatabaseChangeDetection() {
    try {
      console.log('Setting up automatic database change detection...');
      
      const db = this.db.db();
      const riderequestsCollection = db.collection('riderequests');
      const usersCollection = db.collection('users');
      const serviceprovidersCollection = db.collection('serviceproviders');

      // Watch for ride status changes (actual ride progress)
      this.watchRideRequestChanges(riderequestsCollection);
      
      // Watch for ride request status changes (workflow status)
      this.watchRideRequestStatusChanges(riderequestsCollection);
      
      // Watch for new ride requests
      this.watchNewRideRequests(riderequestsCollection);
      
      // Watch for driver/vehicle assignments
      this.watchAssignmentChanges(riderequestsCollection);
      
      // Watch for user and provider changes
      this.watchUserChanges(usersCollection);
      this.watchProviderChanges(serviceprovidersCollection);

      console.log('✅ Automatic database change detection active');
    } catch (error) {
      console.error('Failed to setup database change detection:', error);
      console.log('⚠️  Falling back to manual API detection');
    }
  }

  // Watch for ride status changes (actual ride progress: 0-509)
  private watchRideRequestChanges(collection: any) {
    try {
      const changeStream = collection.watch([
        { 
          $match: { 
            'updateDescription.updatedFields.rideStatus': { $exists: true } 
          } 
        }
      ]);

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'update') {
            const rideUuid = change.documentKey.uuid;
            const newStatus = change.updateDescription.updatedFields.rideStatus;
            const previousStatus = change.updateDescription.updatedFields.rideStatus?.before || 0;
            
            console.log(`🔄 Automatic detection: Ride ${rideUuid} ride status changed from ${previousStatus} to ${newStatus}`);
            
            // Get the full ride request to process the status change
            const rideRequest = await collection.findOne({ uuid: rideUuid });
            if (rideRequest) {
              await this.handleAutomaticRideStatusChange(rideRequest, newStatus, previousStatus);
            }
          }
        } catch (error) {
          console.error('Error processing automatic ride status change:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('Change stream error:', error);
      });

      console.log('👀 Watching for ride status changes (0-509)...');
    } catch (error) {
      console.error('Failed to setup ride status change stream:', error);
    }
  }

  // Watch for ride request status changes (workflow status: 100-1100)
  private watchRideRequestStatusChanges(collection: any) {
    try {
      const changeStream = collection.watch([
        { 
          $match: { 
            'updateDescription.updatedFields.rideRequestStatus': { $exists: true } 
          } 
        }
      ]);

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'update') {
            const rideUuid = change.documentKey.uuid;
            const newStatus = change.updateDescription.updatedFields.rideRequestStatus;
            const previousStatus = change.updateDescription.updatedFields.rideRequestStatus?.before || 0;
            
            console.log(`🔄 Automatic detection: Ride ${rideUuid} request status changed from ${previousStatus} to ${newStatus}`);
            
            // Get the full ride request to process the status change
            const rideRequest = await collection.findOne({ uuid: rideUuid });
            if (rideRequest) {
              await this.handleAutomaticRideRequestStatusChange(rideRequest, newStatus, previousStatus);
            }
          }
        } catch (error) {
          console.error('Error processing automatic ride request status change:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('Change stream error:', error);
      });

      console.log('👀 Watching for ride request status changes (100-1100)...');
    } catch (error) {
      console.error('Failed to setup ride request status change stream:', error);
    }
  }

  // Watch for new ride requests
  private watchNewRideRequests(collection: any) {
    try {
      const changeStream = collection.watch([
        { $match: { operationType: 'insert' } }
      ]);

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'insert') {
            const newRide = change.fullDocument;
            console.log(`🆕 Automatic detection: New ride request created: ${newRide.uuid}`);
            
            // Automatically create the REQUEST_CREATED event
            await this.rideEventManager.requestCreated(newRide);
          }
        } catch (error) {
          console.error('Error processing new ride request:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('New ride change stream error:', error);
      });

      console.log('👀 Watching for new ride requests...');
    } catch (error) {
      console.error('Failed to setup new ride change stream:', error);
    }
  }

  // Watch for driver/vehicle assignment changes
  private watchAssignmentChanges(collection: any) {
    try {
      const changeStream = collection.watch([
        { 
          $match: { 
            $or: [
              { 'updateDescription.updatedFields.assignedDriverUuid': { $exists: true } },
              { 'updateDescription.updatedFields.assignedVehicleUuid': { $exists: true } }
            ]
          } 
        }
      ]);

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'update') {
            const rideUuid = change.documentKey.uuid;
            const updatedFields = change.updateDescription.updatedFields;
            
            if (updatedFields.assignedDriverUuid) {
              console.log(`👨‍💼 Automatic detection: Driver assigned to ride ${rideUuid}`);
              const rideRequest = await collection.findOne({ uuid: rideUuid });
              if (rideRequest) {
                await this.rideEventManager.driverAssigned(rideUuid, rideRequest.serviceUserUuid, updatedFields.assignedDriverUuid);
              }
            }
            
            if (updatedFields.assignedVehicleUuid) {
              console.log(`🚐 Automatic detection: Vehicle assigned to ride ${rideUuid}`);
              const rideRequest = await collection.findOne({ uuid: rideUuid });
              if (rideRequest) {
                await this.rideEventManager.vehicleAssigned(rideUuid, rideRequest.serviceUserUuid, updatedFields.assignedVehicleUuid);
              }
            }
          }
        } catch (error) {
          console.error('Error processing assignment change:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('Assignment change stream error:', error);
      });

      console.log('👀 Watching for driver/vehicle assignments...');
    } catch (error) {
      console.error('Failed to setup assignment change stream:', error);
    }
  }

  // Watch for user changes
  private watchUserChanges(collection: any) {
    try {
      const changeStream = collection.watch();

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'insert') {
            console.log(`👤 Automatic detection: New user created: ${change.fullDocument.uuid}`);
          } else if (change.operationType === 'update') {
            console.log(`👤 Automatic detection: User updated: ${change.documentKey.uuid}`);
          }
        } catch (error) {
          console.error('Error processing user change:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('User change stream error:', error);
      });

      console.log('👀 Watching for user changes...');
    } catch (error) {
      console.error('Failed to setup user change stream:', error);
    }
  }

  // Watch for service provider changes
  private watchProviderChanges(collection: any) {
    try {
      const changeStream = collection.watch();

      changeStream.on('change', async (change: any) => {
        try {
          if (change.operationType === 'insert') {
            console.log(`👨‍💼 Automatic detection: New service provider created: ${change.fullDocument.uuid}`);
          } else if (change.operationType === 'update') {
            console.log(`👨‍💼 Automatic detection: Service provider updated: ${change.documentKey.uuid}`);
          }
        } catch (error) {
          console.error('Error processing provider change:', error);
        }
      });

      changeStream.on('error', (error: any) => {
        console.error('Provider change stream error:', error);
      });

      console.log('👀 Watching for service provider changes...');
    } catch (error) {
      console.error('Failed to setup provider change stream:', error);
    }
  }

  // Handle automatic ride status changes (0-509: actual ride progress)
  private async handleAutomaticRideStatusChange(rideRequest: any, newStatus: number, previousStatus: number) {
    try {
      console.log(`🔄 Processing automatic ride status change: ${previousStatus} → ${newStatus} for ride ${rideRequest.uuid}`);
      
      // Create appropriate event based on ride status codes (0-509)
      switch (newStatus) {
        case 100: // Ride Confirmed
          await this.rideEventManager.requestConfirmed(rideRequest.uuid, rideRequest.serviceUserUuid);
          break;
        case 109: // Ride Canceled by Ride
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'Cancelled automatically');
          break;
        case 200: // Ride Started
          await this.rideEventManager.rideStarted(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || '', 
            rideRequest.assignedVehicleUuid?.toString() || ''
          );
          break;
        case 209: // Ride Interrupted
          await this.rideEventManager.rideInterrupted(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Ride interrupted'
          );
          break;
        case 300: // Rider Picked Up
          await this.rideEventManager.riderPickedUp(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || ''
          );
          break;
        case 309: // Rider Not Picked Up
          await this.rideEventManager.riderNotPickedUp(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Rider not picked up'
          );
          break;
        case 400: // Rider Dropped Off
          await this.rideEventManager.riderDroppedOff(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || ''
          );
          break;
        case 409: // Rider Not Dropped Off
          await this.rideEventManager.riderNotDroppedOff(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Rider not dropped off'
          );
          break;
        case 450: // Roundtrip Returning
          await this.rideEventManager.roundtripReturning(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || ''
          );
          break;
        case 459: // Roundtrip Return Interrupted
          await this.rideEventManager.roundtripReturnInterrupted(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Roundtrip return interrupted'
          );
          break;
        case 475: // Roundtrip Complete
          await this.rideEventManager.roundtripComplete(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || ''
          );
          break;
        case 479: // Roundtrip Completion Interrupted
          await this.rideEventManager.roundtripCompletionInterrupted(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Roundtrip completion interrupted'
          );
          break;
        case 500: // Ride Complete
          await this.rideEventManager.rideComplete(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            rideRequest.assignedDriverUuid?.toString() || ''
          );
          break;
        case 509: // Ride Incomplete
          await this.rideEventManager.rideIncomplete(
            rideRequest.uuid, 
            rideRequest.serviceUserUuid, 
            'Ride marked as incomplete'
          );
          break;
        default:
          console.log(`ℹ️  Ride status ${newStatus} doesn't require automatic action`);
      }
      
      console.log(`✅ Automatic ride status change processed successfully for ride ${rideRequest.uuid}`);
    } catch (error) {
      console.error(`❌ Error processing automatic ride status change for ride ${rideRequest.uuid}:`, error);
    }
  }

  // Handle automatic ride request status changes (100-1100: workflow status)
  private async handleAutomaticRideRequestStatusChange(rideRequest: any, newStatus: number, previousStatus: number) {
    try {
      console.log(`🔄 Processing automatic ride request status change: ${previousStatus} → ${newStatus} for ride ${rideRequest.uuid}`);
      
      // Create appropriate event based on ride request status codes (100-1100)
      switch (newStatus) {
        case 100: // All ride request open
          console.log(`ℹ️  Ride request ${rideRequest.uuid} is now open for processing`);
          break;
        case 109: // All ride request canceled
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'Ride request canceled');
          break;
        case 200: // Driver Needed
          console.log(`ℹ️  Ride request ${rideRequest.uuid} needs driver assignment`);
          break;
        case 209: // Driver Unavailable
          console.log(`ℹ️  Driver unavailable for ride request ${rideRequest.uuid}`);
          break;
        case 300: // Vehicle Needed
          console.log(`ℹ️  Ride request ${rideRequest.uuid} needs vehicle assignment`);
          break;
        case 309: // Vehicle Unavailable
          console.log(`ℹ️  Vehicle unavailable for ride request ${rideRequest.uuid}`);
          break;
        case 400: // Ride Confirmation Needed
          console.log(`ℹ️  Ride confirmation needed for ride request ${rideRequest.uuid}`);
          break;
        case 409: // Ride Canceled, Unconfirmed
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'Ride canceled, unconfirmed');
          break;
        case 500: // ECTC Transport Broker Notified
          console.log(`ℹ️  ECTC transport broker notified for ride request ${rideRequest.uuid}`);
          break;
        case 525: // ECTC Transport Broker Approved
          console.log(`ℹ️  ECTC transport broker approved ride request ${rideRequest.uuid}`);
          break;
        case 599: // ECTC Transport Broker Denied
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'ECTC transport broker denied');
          break;
        case 600: // ECTC Fleet Manager Notified
          console.log(`ℹ️  ECTC fleet manager notified for ride request ${rideRequest.uuid}`);
          break;
        case 625: // ECTC Fleet Manager Approved
          console.log(`ℹ️  ECTC fleet manager approved ride request ${rideRequest.uuid}`);
          break;
        case 699: // ECTC Fleet Manager Denied
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'ECTC fleet manager denied');
          break;
        case 700: // ECTC Staff Notified
          console.log(`ℹ️  ECTC staff notified for ride request ${rideRequest.uuid}`);
          break;
        case 725: // ECTC Staff Approved
          console.log(`ℹ️  ECTC staff approved ride request ${rideRequest.uuid}`);
          break;
        case 799: // ECTC Staff Denied
          await this.rideEventManager.requestCanceled(rideRequest.uuid, rideRequest.serviceUserUuid, 'ECTC staff denied');
          break;
        case 1000: // All ride request ready to ride
          console.log(`ℹ️  Ride request ${rideRequest.uuid} is ready to ride`);
          break;
        case 1100: // All ride request closed
          console.log(`ℹ️  Ride request ${rideRequest.uuid} is closed`);
          break;
        default:
          console.log(`ℹ️  Ride request status ${newStatus} doesn't require automatic action`);
      }
      
      console.log(`✅ Automatic ride request status change processed successfully for ride ${rideRequest.uuid}`);
    } catch (error) {
      console.error(`❌ Error processing automatic ride request status change for ride ${rideRequest.uuid}:`, error);
    }
  }

  private setupEventHandlers() {
    // Handle ride request creation
    this.rideEventManager.on(RideEventType.REQUEST_CREATED, async (event) => {
      console.log('Ride request created:', event.rideRequestUuid);
      
      // Add notification to queue
      await this.notificationQueue.addRideUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'Your ride request has been received and is being processed.',
        'medium'
      );
    });

    // Handle request confirmation
    this.rideEventManager.on(RideEventType.REQUEST_CONFIRMED, async (event) => {
      console.log('Ride request confirmed:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'confirmed'
      );
    });

    // Handle driver assignment
    this.rideEventManager.on(RideEventType.DRIVER_ASSIGNED, async (event) => {
      console.log('Driver assigned to ride:', event.rideRequestUuid);
      
      // Notify service user
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'driver_assigned'
      );

      // Notify driver if they have preferences set
      if (event.driverUuid) {
        await this.notificationQueue.addDriverNotification(
          event.driverUuid.toString(),
          event.rideRequestUuid.toString(),
          'You have been assigned a new ride request. Please review and accept.',
          'high'
        );
      }
    });

    // Handle vehicle assignment
    this.rideEventManager.on(RideEventType.VEHICLE_ASSIGNED, async (event) => {
      console.log('Vehicle assigned to ride:', event.rideRequestUuid);
      
      if (event.driverUuid) {
        await this.notificationQueue.addDriverNotification(
          event.driverUuid.toString(),
          event.rideRequestUuid.toString(),
          'A vehicle has been assigned to your ride request.',
          'medium'
        );
      }
    });

    // Handle ride started
    this.rideEventManager.on(RideEventType.RIDE_STARTED, async (event) => {
      console.log('Ride started:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'ride_started'
      );
    });

    // Handle rider pickup
    this.rideEventManager.on(RideEventType.RIDER_PICKED_UP, async (event) => {
      console.log('Rider picked up:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'pickup_complete'
      );
    });

    // Handle rider dropoff
    this.rideEventManager.on(RideEventType.RIDER_DROPPED_OFF, async (event) => {
      console.log('Rider dropped off:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'dropoff_complete'
      );
    });

    // Handle roundtrip returning
    this.rideEventManager.on(RideEventType.ROUNDTRIP_RETURNING, async (event) => {
      console.log('Roundtrip returning:', event.rideRequestUuid);
      
      await this.notificationQueue.addRoundtripNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'Your return trip has begun. You\'re heading back to your pickup location.'
      );
    });

    // Handle roundtrip completion
    this.rideEventManager.on(RideEventType.ROUNDTRIP_COMPLETE, async (event) => {
      console.log('Roundtrip completed:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'roundtrip_complete'
      );
    });

    // Handle ride completion
    this.rideEventManager.on(RideEventType.RIDE_COMPLETE, async (event) => {
      console.log('Ride completed:', event.rideRequestUuid);
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'completed'
      );
    });

    // Handle request cancellation
    this.rideEventManager.on(RideEventType.REQUEST_CANCELED, async (event) => {
      console.log('Ride request canceled:', event.rideRequestUuid);
      
      // Cancel any pending notifications
      await this.notificationQueue.cancelRideNotifications(event.rideRequestUuid.toString());
      
      await this.notificationQueue.addStatusUpdateNotification(
        event.serviceUserUuid,
        event.rideRequestUuid.toString(),
        'cancelled',
        event.metadata['reason']
      );
    });

    // Handle emergency alerts
    this.rideEventManager.on(RideEventType.EMERGENCY_ALERT, async (event) => {
      console.log('Emergency alert:', event.rideRequestUuid);
      
      // Send urgent notification
      await this.notificationQueue.addEmergencyNotification(
        event.serviceUserUuid,
        event.metadata['message'] || 'Emergency situation detected'
      );

      // Notify emergency contacts if available
      const userPrefs = await this.userPrefsManager.getUserPreferences(event.serviceUserUuid);
      if (userPrefs?.emergencyContacts && userPrefs.emergencyContacts.length > 0) {
        const primaryContact = userPrefs.emergencyContacts.find((c: any) => c.priority === 'primary') || userPrefs.emergencyContacts[0];
        await this.notificationQueue.addEmergencyNotification(
          primaryContact?.phoneNumber || '',
          `Emergency alert for ${primaryContact?.relationship || ''}: ${event.metadata['message']}`
        );
      }
    });
  }

  private setupScheduledTasks() {
    // Check for delayed rides every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.checkForDelays();
    });

    // Send pickup reminders 15 minutes before scheduled time
    cron.schedule('*/15 * * * *', async () => {
      await this.sendPickupReminders();
    });

    // Process notification queue every 10 seconds
    cron.schedule('*/10 * * * * *', async () => {
      await this.processNotificationQueue();
    });
  }

  private async checkForDelays() {
    try {
      console.log('Checking for ride delays...');
      
      // Query for rides that should have started but haven't - using your exact collection name
      const collection = this.db.db().collection('riderequests');
      const delayedRides = await collection.find({
        rideStatus: 100, // Ride Confirmed (0-509 range)
        pickupRequestedTime: { $lte: new Date().toISOString() },
        rideStartedActualTime: { $exists: false }
      }).toArray();

      for (const ride of delayedRides) {
        const delayMinutes = Math.floor((Date.now() - new Date(ride['pickupRequestedTime']).getTime()) / (1000 * 60));
        
        if (delayMinutes > 15) { // Only notify if more than 15 minutes late
          await this.notificationQueue.addDelayNotification(
            ride['serviceUserUuid'],
            ride['uuid'].toString(),
            delayMinutes,
            'Driver is running late'
          );
        }
      }
    } catch (error) {
      console.error('Error checking for delays:', error);
    }
  }

  private async sendPickupReminders() {
    try {
      console.log('Sending pickup reminders...');
      
      const collection = this.db.db().collection('riderequests');
      const now = new Date();
      const reminderTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now
      
      const ridesNeedingReminders = await collection.find({
        rideStatus: 100, // Ride Confirmed (0-509 range)
        ['pickupRequestedTime']: { $gte: now.toISOString(), $lte: reminderTime.toISOString() }
      }).toArray();

      for (const ride of ridesNeedingReminders) {
        await this.notificationQueue.addPickupReminder(
          ride['serviceUserUuid'],
          ride['uuid'].toString(),
          new Date(ride['pickupRequestedTime']),
          ride['pickupAddress']
        );
      }
    } catch (error) {
      console.error('Error sending pickup reminders:', error);
    }
  }

  private async processNotificationQueue() {
    try {
      console.log('🔄 Processing notification queue...');
      
      // Get BOTH pending AND processing notifications
      const pendingNotifications = await this.notificationQueue.getPendingNotifications();
      const processingNotifications = await this.notificationQueue.getProcessingNotifications(); // You might need to add this method
      
      const allNotifications = [...pendingNotifications, ...processingNotifications];
      console.log(`📋 Found ${allNotifications.length} total notifications (${pendingNotifications.length} pending, ${processingNotifications.length} processing)`);
      
      for (const notification of allNotifications) {
        console.log(`📱 Processing notification ${notification.id} (type: ${notification.type}, status: ${notification.status})`);
        
        // Check if notification has been processing for too long
        const processingTime = Date.now() - notification.createdAt.getTime();
        if (processingTime > 30000) { // 30 seconds
          console.log(`⏰ Notification ${notification.id} stuck in processing for ${Math.floor(processingTime/1000)}s, marking as failed`);
          await this.notificationQueue.markNotificationFailed(notification.id, 'Timeout: Stuck in processing for over 30 seconds');
          continue;
        }

        if (notification.type === 'sms') {
          console.log(` Attempting to send SMS to ${notification.recipient}`);
          const success = await this.twilioSender.sendSMS(notification);
          console.log(`📱 SMS result: ${success ? 'SUCCESS' : 'FAILED'}`);
          
          if (success) {
            await this.notificationQueue.markNotificationSent(notification.id);
            console.log(`✅ Notification ${notification.id} marked as sent`);
          } else {
            await this.notificationQueue.markNotificationFailed(notification.id, 'SMS sending failed');
            console.log(`❌ Notification ${notification.id} marked as failed`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing notification queue:', error);
    }
  }

  // API endpoint handlers - Only keeping essential ones for automatic operation
  private async sendEmergencyNotification(req: express.Request, res: express.Response) {
    try {
      const { recipient, message } = req.body;
      const notificationId = await this.notificationQueue.addEmergencyNotification(recipient, message);
      res.json({ message: 'Emergency notification sent', notificationId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send emergency notification' });
    }
  }

  private async getQueueStatus(_req: express.Request, res: express.Response) {
    try {
      const stats = await this.notificationQueue.getQueueStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  private async getUserPreferences(req: express.Request, res: express.Response) {
    try {
      const { uuid } = req.params;
      const prefs = await this.userPrefsManager.getUserPreferences(uuid || '');
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user preferences' });
    }
  }

  private async updateUserPreferences(req: express.Request, res: express.Response) {
    try {
      const { uuid } = req.params;
      const prefs = req.body;
      const success = await this.userPrefsManager.updateUserPreferences(uuid || '', prefs);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user preferences' });
    }
  }

  private async getDriverPreferences(req: express.Request, res: express.Response) {
    try {
      const { uuid } = req.params;
      const prefs = await this.userPrefsManager.getServiceProviderPreferences(parseInt(uuid || '0'));
      res.json(prefs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get driver preferences' });
    }
  }

  private async updateDriverPreferences(req: express.Request, res: express.Response) {
    try {
      const { uuid } = req.params;
      const prefs = req.body;
      const success = await this.userPrefsManager.updateServiceProviderPreferences(parseInt(uuid || '0'), prefs);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update driver preferences' });
    }
  }

  private async getDispatchBotStatus(_req: express.Request, res: express.Response) {
    try {
      const queueStats = await this.notificationQueue.getQueueStats();
      const twilioUsage = await this.twilioSender.getAccountUsage();
      
      res.json({
        status: 'running',
        queue: queueStats,
        twilio: twilioUsage,
        automaticDetection: 'active',
        changeStreams: 'monitoring',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get DispatchBot status' });
    }
  }

  private async handleTwilioStatus(_req: express.Request, res: express.Response) {
    try {
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling Twilio status:', error);
      res.sendStatus(500);
    }
  }

  private async handleTwilioInbound(_req: express.Request, res: express.Response) {
    try {
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling Twilio inbound:', error);
      res.sendStatus(500);
    }
  }

  async start() {
    try {
      await this.initialize();
      
      this.app.listen(this.port, () => {
        console.log(`🚗 DispatchBot running on port ${this.port}`);
        console.log(`📱 Twilio integration: ${this.twilioSender ? 'Active' : 'Inactive'}`);
        console.log(`📊 Notification queue: Active`);
        console.log(`🎯 Ride event system: Active`);
        console.log(`🔗 Connected to your ride request app database`);
      });
    } catch (error) {
      console.error('Failed to start DispatchBot:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      this.notificationQueue.stopProcessing();
      await this.db.close();
      console.log('DispatchBot stopped gracefully');
    } catch (error) {
      console.error('Error stopping DispatchBot:', error);
    }
  }
}

// Start the DispatchBot if this file is run directly
if (require.main === module) {
  const dispatchBot = new DispatchBot();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down DispatchBot...');
    await dispatchBot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down DispatchBot...');
    await dispatchBot.stop();
    process.exit(0);
  });

  dispatchBot.start();
}

export default DispatchBot;
