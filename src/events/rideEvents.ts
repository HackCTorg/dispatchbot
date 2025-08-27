// Ride event types that match your exact ride status system
export enum RideEventType {
  REQUEST_CREATED = 'REQUEST_CREATED',
  REQUEST_CONFIRMED = 'REQUEST_CONFIRMED',
  REQUEST_CANCELED = 'REQUEST_CANCELED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  VEHICLE_ASSIGNED = 'VEHICLE_ASSIGNED',
  RIDE_STARTED = 'RIDE_STARTED',
  RIDE_INTERRUPTED = 'RIDE_INTERRUPTED',
  RIDER_PICKED_UP = 'RIDER_PICKED_UP',
  RIDER_NOT_PICKED_UP = 'RIDER_NOT_PICKED_UP',
  RIDER_DROPPED_OFF = 'RIDER_DROPPED_OFF',
  RIDER_NOT_DROPPED_OFF = 'RIDER_NOT_DROPPED_OFF',
  ROUNDTRIP_RETURNING = 'ROUNDTRIP_RETURNING',
  ROUNDTRIP_RETURN_INTERRUPTED = 'ROUNDTRIP_RETURN_INTERRUPTED',
  ROUNDTRIP_COMPLETE = 'ROUNDTRIP_COMPLETE',
  ROUNDTRIP_COMPLETION_INTERRUPTED = 'ROUNDTRIP_COMPLETION_INTERRUPTED',
  RIDE_COMPLETE = 'RIDE_COMPLETE',
  RIDE_INCOMPLETE = 'RIDE_INCOMPLETE',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT'
}

// Your exact ride request status codes (workflow status: 100-1100)
export enum RideRequestStatus {
  ALL_RIDE_REQUEST_OPEN = 100,                    // All ride request open
  ALL_RIDE_REQUEST_CANCELED = 109,                // All ride request canceled
  DRIVER_NEEDED = 200,                            // Driver Needed
  DRIVER_UNAVAILABLE = 209,                       // Driver Unavailable
  VEHICLE_NEEDED = 300,                           // Vehicle Needed
  VEHICLE_UNAVAILABLE = 309,                      // Vehicle Unavailable
  RIDE_CONFIRMATION_NEEDED = 400,                 // Ride Confirmation Needed
  RIDE_CANCELED_UNCONFIRMED = 409,                // Ride Canceled, Unconfirmed
  ECTC_TRANSPORT_BROKER_NOTIFIED = 500,           // ECTC Transport Broker Notified
  ECTC_TRANSPORT_BROKER_APPROVED = 525,           // ECTC Transport Broker Approved
  ECTC_TRANSPORT_BROKER_DENIED = 599,             // ECTC Transport Broker Denied
  ECTC_FLEET_MANAGER_NOTIFIED = 600,              // ECTC Fleet Manager Notified
  ECTC_FLEET_MANAGER_APPROVED = 625,              // ECTC Fleet Manager Approved
  ECTC_FLEET_MANAGER_DENIED = 699,                // ECTC Fleet Manager Denied
  ECTC_STAFF_NOTIFIED = 700,                      // ECTC Staff Notified
  ECTC_STAFF_APPROVED = 725,                      // ECTC Staff Approved
  ECTC_STAFF_DENIED = 799,                        // ECTC Staff Denied
  ALL_RIDE_REQUEST_READY_TO_RIDE = 1000,          // All ride request ready to ride
  ALL_RIDE_REQUEST_CLOSED = 1100                  // All ride request closed
}

export enum RideStatus {
  REQUEST_IN_PROGRESS = 0,        // Ride Request In Progress
  RIDE_CONFIRMED = 100,           // Ride Confirmed
  RIDE_CANCELED_BY_RIDE = 109,    // Ride Canceled by Ride
  RIDE_STARTED = 200,             // Ride Started
  RIDE_INTERRUPTED = 209,         // Ride Interrupted
  RIDER_PICKED_UP = 300,          // Rider Picked Up
  RIDER_NOT_PICKED_UP = 309,      // Rider Not Picked Up
  RIDER_DROPPED_OFF = 400,        // Rider Dropped Off
  RIDER_NOT_DROPPED_OFF = 409,    // Rider Not Dropped Off
  ROUNDTRIP_RETURNING = 450,      // Roundtrip Returning
  ROUNDTRIP_RETURN_INTERRUPTED = 459, // Roundtrip Return Interrupted
  ROUNDTRIP_COMPLETE = 475,       // Roundtrip Complete
  ROUNDTRIP_COMPLETION_INTERRUPTED = 479, // Roundtrip Completion Interrupted
  RIDE_COMPLETE = 500,            // Ride Complete
  RIDE_INCOMPLETE = 509           // Ride Incomplete
}

// Ride event interface that matches your data structure
export interface RideEvent {
  id: string;
  rideRequestUuid: number; // Your exact field name
  serviceUserUuid: string; // Your exact field name
  driverUuid?: number;     // Your exact field name
  vehicleUuid?: number;    // Your exact field name
  eventType: RideEventType;
  timestamp: Date;
  metadata: Record<string, any>;
  createdAt: Date;
}

// Ride request interface matching your EXACT Mongoose model
export interface RideRequest {
  uuid: number;                    // Your exact field name
  serviceUserUuid: string;         // Your exact field name
  serviceUserRole: string;         // Your exact field name
  pickupAddress: string;           // Your exact field name
  dropOffAddress: string;          // Your exact field name
  assignedVehicleUuid?: number;    // Your exact field name
  assignedDriverUuid?: number;     // Your exact field name
  roundTrip: boolean;              // Your exact field name
  pickupRequestedTime: string;     // Your exact field name
  dropOffRequestedTime: string;    // Your exact field name
  rideStartedActualTime: Date;     // Your exact field name
  pickupActualTime: Date;          // Your exact field name
  dropOffActualTime: Date;         // Your exact field name
  roundTripReturnStartedActualTime?: Date; // Your exact field name
  roundTripReturnCompletedActualTime?: Date; // Your exact field name
  rideCompleteRequestedTime: Date; // Your exact field name
  rideCompleteActualTime: Date;    // Your exact field name
  rideStatus: number;              // Your exact status codes
  purpose: string;                 // Your exact field name
  rideRequestStatus: number;       // Your exact field name
  notes?: string;                  // Your exact field name
  createdAt?: Date;
  updatedAt?: Date;
}

export class RideEventManager {
  private db: any;
  private eventHandlers: Map<RideEventType, Array<(event: RideEvent) => void>>;

  constructor(database: any) {
    this.db = database;
    this.eventHandlers = new Map();
    this.initializeEventHandlers();
  }

  private initializeEventHandlers() {
    // Initialize empty arrays for each event type
    Object.values(RideEventType).forEach(type => {
      this.eventHandlers.set(type, []);
    });
  }

  // Event handling system
  on(eventType: RideEventType, handler: (event: RideEvent) => void) {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  private async emit(eventType: RideEventType, event: RideEvent) {
    const handlers = this.eventHandlers.get(eventType) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    }
  }

  // Create ride events that match your exact status codes
  async requestCreated(rideRequest: RideRequest): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid: rideRequest.uuid,
      serviceUserUuid: rideRequest.serviceUserUuid,
      eventType: RideEventType.REQUEST_CREATED,
      timestamp: new Date(),
      metadata: {
        pickupAddress: rideRequest.pickupAddress,
        dropOffAddress: rideRequest.dropOffAddress,
        roundTrip: rideRequest.roundTrip,
        purpose: rideRequest.purpose
      },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.REQUEST_CREATED, event);
  }

  async requestConfirmed(rideRequestUuid: number, serviceUserUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.REQUEST_CONFIRMED,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.REQUEST_CONFIRMED, event);
  }

  async requestCanceled(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.REQUEST_CANCELED,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.REQUEST_CANCELED, event);
  }

  async driverAssigned(rideRequestUuid: number, serviceUserUuid: string, driverUuid: number): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid,
      eventType: RideEventType.DRIVER_ASSIGNED,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.DRIVER_ASSIGNED, event);
  }

  async vehicleAssigned(rideRequestUuid: number, serviceUserUuid: string, vehicleUuid: number): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      vehicleUuid,
      eventType: RideEventType.VEHICLE_ASSIGNED,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.VEHICLE_ASSIGNED, event);
  }

  async rideStarted(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string, vehicleUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      vehicleUuid: parseInt(vehicleUuid),
      eventType: RideEventType.RIDE_STARTED,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDE_STARTED, event);
  }

  async rideInterrupted(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.RIDE_INTERRUPTED,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDE_INTERRUPTED, event);
  }

  async riderPickedUp(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      eventType: RideEventType.RIDER_PICKED_UP,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDER_PICKED_UP, event);
  }

  async riderNotPickedUp(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.RIDER_NOT_PICKED_UP,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDER_NOT_PICKED_UP, event);
  }

  async riderDroppedOff(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      eventType: RideEventType.RIDER_DROPPED_OFF,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDER_DROPPED_OFF, event);
  }

  async riderNotDroppedOff(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.RIDER_NOT_DROPPED_OFF,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDER_NOT_DROPPED_OFF, event);
  }

  async roundtripReturning(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      eventType: RideEventType.ROUNDTRIP_RETURNING,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.ROUNDTRIP_RETURNING, event);
  }

  async roundtripReturnInterrupted(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.ROUNDTRIP_RETURN_INTERRUPTED,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.ROUNDTRIP_RETURN_INTERRUPTED, event);
  }

  async roundtripComplete(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      eventType: RideEventType.ROUNDTRIP_COMPLETE,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.ROUNDTRIP_COMPLETE, event);
  }

  async roundtripCompletionInterrupted(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.ROUNDTRIP_COMPLETION_INTERRUPTED,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.ROUNDTRIP_COMPLETION_INTERRUPTED, event);
  }

  async rideComplete(rideRequestUuid: number, serviceUserUuid: string, driverUuid: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      driverUuid: parseInt(driverUuid),
      eventType: RideEventType.RIDE_COMPLETE,
      timestamp: new Date(),
      metadata: {},
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDE_COMPLETE, event);
  }

  async rideIncomplete(rideRequestUuid: number, serviceUserUuid: string, reason: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.RIDE_INCOMPLETE,
      timestamp: new Date(),
      metadata: { reason },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.RIDE_INCOMPLETE, event);
  }

  async emergencyAlert(rideRequestUuid: number, serviceUserUuid: string, message: string): Promise<void> {
    const event: RideEvent = {
      id: this.generateEventId(),
      rideRequestUuid,
      serviceUserUuid,
      eventType: RideEventType.EMERGENCY_ALERT,
      timestamp: new Date(),
      metadata: { message },
      createdAt: new Date()
    };

    await this.storeEvent(event);
    await this.emit(RideEventType.EMERGENCY_ALERT, event);
  }

  // Store event in database
  private async storeEvent(event: RideEvent): Promise<void> {
    try {
      const collection = this.db.collection('rideEvents');
      await collection.insertOne(event);
    } catch (error) {
      console.error('Error storing ride event:', error);
    }
  }

  // Get events for a specific ride
  async getRideEvents(rideRequestUuid: number): Promise<RideEvent[]> {
    try {
      const collection = this.db.collection('rideEvents');
      return await collection.find({ rideRequestUuid }).sort({ timestamp: 1 }).toArray();
    } catch (error) {
      console.error('Error fetching ride events:', error);
      return [];
    }
  }

  // Helper methods that work with your exact status codes
  getRideStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      [RideStatus.REQUEST_IN_PROGRESS]: 'Ride Request In Progress',
      [RideStatus.RIDE_CONFIRMED]: 'Ride Confirmed',
      [RideStatus.RIDE_CANCELED_BY_RIDE]: 'Ride Canceled by Ride',
      [RideStatus.RIDE_STARTED]: 'Ride Started',
      [RideStatus.RIDE_INTERRUPTED]: 'Ride Interrupted',
      [RideStatus.RIDER_PICKED_UP]: 'Rider Picked Up',
      [RideStatus.RIDER_NOT_PICKED_UP]: 'Rider Not Picked Up',
      [RideStatus.RIDER_DROPPED_OFF]: 'Rider Dropped Off',
      [RideStatus.RIDER_NOT_DROPPED_OFF]: 'Rider Not Dropped Off',
      [RideStatus.ROUNDTRIP_RETURNING]: 'Roundtrip Returning',
      [RideStatus.ROUNDTRIP_RETURN_INTERRUPTED]: 'Roundtrip Return Interrupted',
      [RideStatus.ROUNDTRIP_COMPLETE]: 'Roundtrip Complete',
      [RideStatus.ROUNDTRIP_COMPLETION_INTERRUPTED]: 'Roundtrip Completion Interrupted',
      [RideStatus.RIDE_COMPLETE]: 'Ride Complete',
      [RideStatus.RIDE_INCOMPLETE]: 'Ride Incomplete'
    };
    return descriptions[status] || 'Unknown Status';
  }

  isRideActive(status: number): boolean {
    return status >= RideStatus.RIDE_STARTED && status < RideStatus.RIDE_COMPLETE;
  }

  isRideCompleted(status: number): boolean {
    return status === RideStatus.RIDE_COMPLETE || status === RideStatus.ROUNDTRIP_COMPLETE;
  }

  isRideCanceled(status: number): boolean {
    return status === RideStatus.RIDE_CANCELED_BY_RIDE;
  }

  // Helper method for ride request status descriptions (workflow status: 100-1100)
  getRideRequestStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      [RideRequestStatus.ALL_RIDE_REQUEST_OPEN]: 'All ride request open',
      [RideRequestStatus.ALL_RIDE_REQUEST_CANCELED]: 'All ride request canceled',
      [RideRequestStatus.DRIVER_NEEDED]: 'Driver Needed',
      [RideRequestStatus.DRIVER_UNAVAILABLE]: 'Driver Unavailable',
      [RideRequestStatus.VEHICLE_NEEDED]: 'Vehicle Needed',
      [RideRequestStatus.VEHICLE_UNAVAILABLE]: 'Vehicle Unavailable',
      [RideRequestStatus.RIDE_CONFIRMATION_NEEDED]: 'Ride Confirmation Needed',
      [RideRequestStatus.RIDE_CANCELED_UNCONFIRMED]: 'Ride Canceled, Unconfirmed',
      [RideRequestStatus.ECTC_TRANSPORT_BROKER_NOTIFIED]: 'ECTC Transport Broker Notified',
      [RideRequestStatus.ECTC_TRANSPORT_BROKER_APPROVED]: 'ECTC Transport Broker Approved',
      [RideRequestStatus.ECTC_TRANSPORT_BROKER_DENIED]: 'ECTC Transport Broker Denied',
      [RideRequestStatus.ECTC_FLEET_MANAGER_NOTIFIED]: 'ECTC Fleet Manager Notified',
      [RideRequestStatus.ECTC_FLEET_MANAGER_APPROVED]: 'ECTC Fleet Manager Approved',
      [RideRequestStatus.ECTC_FLEET_MANAGER_DENIED]: 'ECTC Fleet Manager Denied',
      [RideRequestStatus.ECTC_STAFF_NOTIFIED]: 'ECTC Staff Notified',
      [RideRequestStatus.ECTC_STAFF_APPROVED]: 'ECTC Staff Approved',
      [RideRequestStatus.ECTC_STAFF_DENIED]: 'ECTC Staff Denied',
      [RideRequestStatus.ALL_RIDE_REQUEST_READY_TO_RIDE]: 'All ride request ready to ride',
      [RideRequestStatus.ALL_RIDE_REQUEST_CLOSED]: 'All ride request closed'
    };
    return descriptions[status] || 'Unknown Ride Request Status';
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
