// Service User (Elderly person) interface matching your EXACT Mongoose model
export interface ServiceUser {
  uuid: string;
  fullname: string;
  phone: string;
  dob: string;
  race: 'black' | 'white' | 'asian' | 'latino' | 'native american' | 'other' | 'prefer not to say';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'other' | 'prefer not to say';
  residence: {
    current?: string;
    last: string;
  };
  income: {
    current?: string;
    last: string;
  };
  serviceUserRole: ('rider' | 'caregiver' | 'relative' | 'guardian' | 'case manager' | 'other')[];
  veteranStatus?: 'veteran' | 'not veteran' | 'prefer not to say';
  disabilityStatus?: 'yes' | 'no' | 'prefer not to say';
  createdAt?: Date;
  updatedAt?: Date;
}

// Service Provider (Driver/Staff) interface matching your EXACT Mongoose model
export interface ServiceProvider {
  uuid: number;
  fullName: string;
  title: string;
  organization: 'EASTCONN' | 'Generations Health' | 'other';
  phone: string;
  role: 'Transport Broker' | 'Staff' | 'Fleet Manager' | 'Driver' | 'Admin';
  specializations?: 'Caseworker' | 'Nutritionist' | 'Intake';
  faxPhone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Ride Request interface matching your EXACT Mongoose model
export interface RideRequest {
  uuid: number;
  serviceUserUuid: string;
  serviceUserRole: string;
  pickupAddress: string;
  dropOffAddress: string;
  assignedVehicleUuid?: number;
  assignedDriverUuid?: number;
  roundTrip: boolean;
  pickupRequestedTime: string;
  dropOffRequestedTime: string;
  rideStartedActualTime: Date;
  pickupActualTime: Date;
  dropOffActualTime: Date;
  roundTripReturnStartedActualTime?: Date;
  roundTripReturnCompletedActualTime?: Date;
  rideCompleteRequestedTime: Date;
  rideCompleteActualTime: Date;
  rideStatus: number; // Your exact status codes (0, 100, 200, 300, etc.)
  purpose: string;
  rideRequestStatus: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// User preferences for communication and notifications
export interface UserPreferences {
  serviceUserUuid: string;
  phoneNumber: string;
  preferredLanguage: 'en' | 'es' | 'fr';
  notificationPreferences: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
  rideUpdates: {
    requestConfirmation: boolean;
    driverAssigned: boolean;
    pickupReminder: boolean;
    rideStart: boolean;
    rideComplete: boolean;
    delays: boolean;
    roundtripUpdates: boolean;
  };
  emergencyContacts: Array<{
    name: string;
    phoneNumber: string;
    relationship: string;
    priority: 'primary' | 'secondary' | 'tertiary';
  }>;
  accessibility: {
    requiresLargeText: boolean;
    requiresVoiceCalls: boolean;
    preferredContactTime: 'anytime' | 'business-hours' | 'evening';
    mobilityAssistance: boolean;
    communicationAssistance: boolean;
  };
  specialNeeds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Service Provider preferences for notifications and availability
export interface ServiceProviderPreferences {
  providerUuid: number;
  phoneNumber: string;
  serviceAreas: string[];
  vehicleTypes: string[];
  availability: {
    days: number[]; // 0-6 (Sunday-Saturday)
    hours: {
      start: string; // "08:00"
      end: string;   // "18:00"
    };
    isAvailable: boolean;
  };
  notificationPreferences: {
    newRideRequests: boolean;
    rideUpdates: boolean;
    cancellations: boolean;
    emergencyAlerts: boolean;
    systemMaintenance: boolean;
  };
  maxDistance: number; // in miles
  specializations: string[]; // ["wheelchair", "oxygen", "companion"]
  currentLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class UserPrefsManager {
  private db: any; // MongoDB connection

  constructor(database: any) {
    this.db = database;
  }

  // Service User Management - Uses your exact collection name 'users'
  async getServiceUser(uuid: string): Promise<ServiceUser | null> {
    try {
      const collection = this.db.collection('users');
      return await collection.findOne({ uuid });
    } catch (error) {
      console.error('Error fetching service user:', error);
      return null;
    }
  }

  async createServiceUser(userData: Omit<ServiceUser, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const collection = this.db.collection('users');
      const newUser: ServiceUser = {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newUser);
      return true;
    } catch (error) {
      console.error('Error creating service user:', error);
      return false;
    }
  }

  async updateServiceUser(uuid: string, updates: Partial<ServiceUser>): Promise<boolean> {
    try {
      const collection = this.db.collection('users');
      const result = await collection.updateOne(
        { uuid },
        { 
          $set: { 
            ...updates,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating service user:', error);
      return false;
    }
  }

  // Service Provider Management - Uses your exact collection name 'service-providers'
  async getServiceProvider(uuid: number): Promise<ServiceProvider | null> {
    try {
      const collection = this.db.collection('service-providers');
      return await collection.findOne({ uuid });
    } catch (error) {
      console.error('Error fetching service provider:', error);
      return null;
    }
  }

  async createServiceProvider(providerData: Omit<ServiceProvider, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const collection = this.db.collection('service-providers');
      const newProvider: ServiceProvider = {
        ...providerData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newProvider);
      return true;
    } catch (error) {
      console.error('Error creating service provider:', error);
      return false;
    }
  }

  async updateServiceProvider(uuid: number, updates: Partial<ServiceProvider>): Promise<boolean> {
    try {
      const collection = this.db.collection('service-providers');
      const result = await collection.updateOne(
        { uuid },
        { 
          $set: { 
            ...updates,
            updatedAt: new Date() }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating service provider:', error);
      return false;
    }
  }

  // Ride Request Management - Uses your exact collection name 'ride-requests'
  async getRideRequest(uuid: number): Promise<RideRequest | null> {
    try {
      const collection = this.db.collection('ride-requests');
      return await collection.findOne({ uuid });
    } catch (error) {
      console.error('Error fetching ride request:', error);
      return null;
    }
  }

  async updateRideRequest(uuid: number, updates: Partial<RideRequest>): Promise<boolean> {
    try {
      const collection = this.db.collection('ride-requests');
      const result = await collection.updateOne(
        { uuid },
        { 
          $set: { 
            ...updates,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating ride request:', error);
      return false;
    }
  }

  // Get all drivers (Service Providers with Driver role)
  async getAvailableDrivers(): Promise<ServiceProvider[]> {
    try {
      const collection = this.db.collection('service-providers');
      return await collection.find({ 
        role: 'Driver',
        'availability.isAvailable': true
      }).toArray();
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      return [];
    }
  }

  // Get all fleet managers
  async getFleetManagers(): Promise<ServiceProvider[]> {
    try {
      const collection = this.db.collection('service-providers');
      return await collection.find({ role: 'Fleet Manager' }).toArray();
    } catch (error) {
      console.error('Error fetching fleet managers:', error);
      return [];
    }
  }

  // Get all transport brokers
  async getTransportBrokers(): Promise<ServiceProvider[]> {
    try {
      const collection = this.db.collection('service-providers');
      return await collection.find({ role: 'Transport Broker' }).toArray();
    } catch (error) {
      console.error('Error fetching transport brokers:', error);
      return [];
    }
  }

  // User Preferences Management
  async getUserPreferences(serviceUserUuid: string): Promise<UserPreferences | null> {
    try {
      const collection = this.db.collection('userPreferences');
      return await collection.findOne({ serviceUserUuid });
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      return null;
    }
  }

  async createUserPreferences(prefs: Omit<UserPreferences, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const collection = this.db.collection('userPreferences');
      const newPrefs: UserPreferences = {
        ...prefs,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newPrefs);
      return true;
    } catch (error) {
      console.error('Error creating user preferences:', error);
      return false;
    }
  }

  async updateUserPreferences(serviceUserUuid: string, prefs: Partial<UserPreferences>): Promise<boolean> {
    try {
      const collection = this.db.collection('userPreferences');
      const result = await collection.updateOne(
        { serviceUserUuid },
        { 
          $set: { 
            ...prefs,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return false;
    }
  }

  // Service Provider Preferences Management
  async getServiceProviderPreferences(providerUuid: number): Promise<ServiceProviderPreferences | null> {
    try {
      const collection = this.db.collection('serviceProviderPreferences');
      return await collection.findOne({ providerUuid });
    } catch (error) {
      console.error('Error fetching provider preferences:', error);
      return null;
    }
  }

  async createServiceProviderPreferences(prefs: Omit<ServiceProviderPreferences, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const collection = this.db.collection('serviceProviderPreferences');
      const newPrefs: ServiceProviderPreferences = {
        ...prefs,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(newPrefs);
      return true;
    } catch (error) {
      console.error('Error creating provider preferences:', error);
      return false;
    }
  }

  async updateServiceProviderPreferences(providerUuid: number, prefs: Partial<ServiceProviderPreferences>): Promise<boolean> {
    try {
      const collection = this.db.collection('serviceProviderPreferences');
      const result = await collection.updateOne(
        { providerUuid },
        { 
          $set: { 
            ...prefs,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    } catch (error) {
      console.error('Error updating provider preferences:', error);
      return false;
    }
  }

  // Emergency Contact Management
  async getEmergencyContacts(serviceUserUuid: string): Promise<Array<{
    name: string;
    phoneNumber: string;
    relationship: string;
    priority: 'primary' | 'secondary' | 'tertiary';
  }> | null> {
    try {
      const prefs = await this.getUserPreferences(serviceUserUuid);
      return prefs?.emergencyContacts || null;
    } catch (error) {
      console.error('Error fetching emergency contacts:', error);
      return null;
    }
  }

  async addEmergencyContact(serviceUserUuid: string, contact: {
    name: string;
    phoneNumber: string;
    relationship: string;
    priority: 'primary' | 'secondary' | 'tertiary';
  }): Promise<boolean> {
    try {
      const collection = this.db.collection('userPreferences');
      const result = await collection.updateOne(
        { serviceUserUuid },
        { 
          $push: { emergencyContacts: contact },
          $set: { updatedAt: new Date() }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error adding emergency contact:', error);
      return false;
    }
  }

  // Special Needs Management
  async getSpecialNeeds(serviceUserUuid: string): Promise<string[] | null> {
    try {
      const prefs = await this.getUserPreferences(serviceUserUuid);
      return prefs?.specialNeeds || null;
    } catch (error) {
      console.error('Error fetching special needs:', error);
      return null;
    }
  }

  async updateSpecialNeeds(serviceUserUuid: string, specialNeeds: string[]): Promise<boolean> {
    try {
      const collection = this.db.collection('userPreferences');
      const result = await collection.updateOne(
        { serviceUserUuid },
        { 
          $set: { 
            specialNeeds,
            updatedAt: new Date()
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating special needs:', error);
      return false;
    }
  }

  // Utility Methods
  async isUserRider(serviceUserUuid: string): Promise<boolean> {
    try {
      const user = await this.getServiceUser(serviceUserUuid);
      return user?.serviceUserRole.includes('rider') || false;
    } catch (error) {
      console.error('Error checking if user is rider:', error);
      return false;
    }
  }

  async isUserCaregiver(serviceUserUuid: string): Promise<boolean> {
    try {
      const user = await this.getServiceUser(serviceUserUuid);
      return user?.serviceUserRole.includes('caregiver') || false;
    } catch (error) {
      console.error('Error checking if user is caregiver:', error);
      return false;
    }
  }

  async isProviderDriver(providerUuid: number): Promise<boolean> {
    try {
      const provider = await this.getServiceProvider(providerUuid);
      return provider?.role === 'Driver';
    } catch (error) {
      console.error('Error checking if provider is driver:', error);
      return false;
    }
  }

  async isProviderFleetManager(providerUuid: number): Promise<boolean> {
    try {
      const provider = await this.getServiceProvider(providerUuid);
      return provider?.role === 'Fleet Manager';
    } catch (error) {
      console.error('Error checking if provider is fleet manager:', error);
      return false;
    }
  }

  // Get users by role
  async getUsersByRole(role: string): Promise<ServiceUser[]> {
    try {
      const collection = this.db.collection('users');
      return await collection.find({ serviceUserRole: role }).toArray();
    } catch (error) {
      console.error('Error fetching users by role:', error);
      return [];
    }
  }

  // Get providers by role
  async getProvidersByRole(role: string): Promise<ServiceProvider[]> {
    try {
      const collection = this.db.collection('service-providers');
      return await collection.find({ role }).toArray();
    } catch (error) {
      console.error('Error fetching providers by role:', error);
      return [];
    }
  }

  // Get all active ride requests
  async getActiveRideRequests(): Promise<RideRequest[]> {
    try {
      const collection = this.db.collection('ride-requests');
      // Get rides that are not in closing statuses
      return await collection.find({
        rideStatus: { 
          $nin: [109, 209, 309, 409, 459, 479, 500, 509] // Your closing status codes
        }
      }).toArray();
    } catch (error) {
      console.error('Error fetching active ride requests:', error);
      return [];
    }
  }

  // Get ride requests by status
  async getRideRequestsByStatus(status: number): Promise<RideRequest[]> {
    try {
      const collection = this.db.collection('ride-requests');
      return await collection.find({ rideStatus: status }).toArray();
    } catch (error) {
      console.error('Error fetching ride requests by status:', error);
      return [];
    }
  }
}
