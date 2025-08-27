# 🚗 DispatchBot System Overview

## What is DispatchBot?

DispatchBot is an automated notification and communication system designed specifically for your elderly care ride service. It acts as the "brain" that:

- **Monitors ride requests** and automatically sends SMS updates
- **Tracks ride status changes** and notifies relevant parties
- **Handles emergency situations** with immediate alerts
- **Manages communication preferences** for elderly users and caregivers
- **Provides real-time updates** via Twilio SMS integration

## 🏗️ How It Integrates With Your System

### Your Existing Ride Request Format
DispatchBot is designed to work with your exact data structure:

```typescript
interface RideRequest {
  rideRequestUuid: string;           // Your unique identifier
  serviceUserUuid: string;           // Elderly person's ID
  pickupBaseAddress: string;         // Pickup location
  dropoffBaseAddress: string;        // Destination
  pickupLocationUuid: string;        // Location UUID
  dropoffLocationUuid: string;       // Location UUID
  assignedVehicleUuid?: string;      // Vehicle assignment
  assignedDriverUuid?: string;       // Driver assignment
  roundtrip: boolean;                // Roundtrip flag
  pickupRequestedDatetime: Date;     // Requested pickup time
  dropoffRequestedDatetime: Date;    // Requested dropoff time
  rideStatus: RideRequestStatus;     // Your status codes (0, 100, 200, etc.)
  purposeOfTrip: string;             // Trip purpose
  rideRequestStatus: string;         // Request status
  notes?: string;                    // Additional notes
}
```

### Your Status Code Mapping
DispatchBot automatically maps your numeric status codes to appropriate notifications:

| Your Status | DispatchBot Action | SMS Sent To |
|-------------|-------------------|-------------|
| **0** (In Progress) | Creates ride request event | Service User |
| **100** (Confirmed) | Confirms ride request | Service User |
| **200** (Started) | Notifies ride has begun | Service User |
| **300** (Picked Up) | Confirms pickup | Service User |
| **400** (Dropped Off) | Confirms dropoff | Service User |
| **450** (Returning) | Notifies return trip | Service User |
| **475** (Roundtrip Complete) | Confirms return | Service User |
| **500** (Complete) | Final confirmation | Service User |
| **109** (Canceled) | Cancels notifications | Service User + Driver |

## 🔄 How It Works

### 1. **Ride Request Creation**
```typescript
// Your system creates a ride request
POST /api/rides
{
  "rideRequestUuid": "RIDE_12345",
  "serviceUserUuid": "USER_001",
  "pickupBaseAddress": "123 Main St",
  "dropoffBaseAddress": "456 Oak Ave",
  "rideStatus": 0,
  // ... other fields
}

// DispatchBot automatically:
// - Stores the ride request
// - Creates a "REQUEST_CREATED" event
// - Sends confirmation SMS to service user
// - Queues pickup reminder (15 min before)
```

### 2. **Driver Assignment**
```typescript
// Your system assigns a driver
POST /api/rides/RIDE_12345/assign
{
  "driverUuid": "DRIVER_001"
}

// DispatchBot automatically:
// - Updates ride request with driver
// - Creates "DRIVER_ASSIGNED" event
// - Sends SMS to service user: "Driver assigned!"
// - Sends SMS to driver: "New ride request assigned"
```

### 3. **Status Updates**
```typescript
// Your system updates ride status
PUT /api/rides/RIDE_12345/status
{
  "status": 300,  // Rider picked up
  "reason": null
}

// DispatchBot automatically:
// - Updates ride status in database
// - Creates "RIDER_PICKED_UP" event
// - Sends SMS to service user: "You have been picked up!"
// - Logs the status change
```

### 4. **Automatic Notifications**
DispatchBot runs background tasks that:

- **Check for delays** every 5 minutes
- **Send pickup reminders** 15 minutes before scheduled time
- **Process notification queue** every 10 seconds
- **Handle retry logic** for failed SMS deliveries

## 📱 SMS Notification Examples

### Ride Confirmation
```
Your ride request has been received! We'll notify you when a driver is assigned. Request ID: RIDE_12345
```

### Driver Assigned
```
Great news! Driver John Smith has been assigned to your ride. They'll arrive at 2:30 PM. Driver phone: +1987654321
```

### Pickup Reminder
```
Reminder: Your ride is scheduled for pickup at 2:30 PM from 123 Main St. Please be ready.
```

### Emergency Alert
```
🚨 EMERGENCY: Medical emergency during ride. Please call 911 if this is life-threatening.
```

## 🚨 Emergency Handling

### Automatic Emergency Response
When an emergency is detected:

1. **Immediate SMS** to service user
2. **Alert emergency contacts** (if configured)
3. **Notify support team**
4. **Log emergency** for follow-up
5. **Update ride status** to interrupted (209)

### Emergency Contact Setup
```typescript
// Set up emergency contacts
PUT /api/users/USER_001/preferences
{
  "emergencyContact": {
    "name": "Jane Smith",
    "phoneNumber": "+1234567890",
    "relationship": "Daughter"
  }
}
```

## ⚙️ Configuration

### Environment Variables
```bash
# Required
MONGODB_URI=mongodb://localhost:27017/dispatchbot
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_FROM_NUMBER=+1234567890

# Optional
PORT=3000
TWILIO_WEBHOOK_URL=https://your-domain.com/webhooks/twilio
```

### Twilio Setup
1. **Create Twilio account** at [twilio.com](https://www.twilio.com)
2. **Get phone number** for sending SMS
3. **Set webhook URLs** for status updates
4. **Configure environment variables**

## 🔌 API Integration

### Main Endpoints
- `POST /api/rides` - Create ride request
- `PUT /api/rides/:uuid/status` - Update ride status
- `POST /api/rides/:uuid/assign` - Assign driver
- `POST /api/rides/:uuid/vehicle` - Assign vehicle
- `GET /api/rides/:uuid` - Get ride details
- `GET /api/dispatchbot/status` - System status

### Webhook Endpoints
- `POST /webhooks/twilio/status` - SMS delivery status
- `POST /webhooks/twilio/inbound` - Incoming SMS messages

## 📊 Monitoring & Analytics

### Real-time Dashboard
- **Queue status** - Pending, processing, sent, failed notifications
- **Delivery rates** - SMS success/failure statistics
- **System health** - Uptime and performance metrics
- **Ride statistics** - Active rides, completion rates

### Key Metrics
- SMS delivery success rate
- Notification response times
- Queue processing speed
- Emergency response times

## 🚀 Getting Started

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Configure Environment**
```bash
cp env.example .env
# Edit .env with your settings
```

### 3. **Start DispatchBot**
```bash
npm run dev    # Development mode
npm start      # Production mode
```

### 4. **Test Integration**
```bash
node example-usage.js
```

## 🔧 Customization

### Message Templates
Customize SMS messages for different scenarios:

```typescript
// Add custom template
await templateManager.createTemplate({
  name: 'Custom Welcome',
  category: 'general',
  language: 'en',
  template: 'Welcome {userName}! Your ride is scheduled for {pickupTime}.',
  variables: ['userName', 'pickupTime']
});
```

### User Preferences
Set communication preferences per user:

```typescript
// Configure user preferences
PUT /api/users/USER_001/preferences
{
  "notificationPreferences": {
    "sms": true,
    "email": false,
    "push": false
  },
  "rideUpdates": {
    "requestConfirmation": true,
    "providerAssigned": true,
    "pickupReminder": true,
    "rideStart": true,
    "rideComplete": true,
    "delays": true
  }
}
```

## 🆘 Support & Troubleshooting

### Common Issues
1. **SMS not sending** - Check Twilio credentials and webhook URLs
2. **Database connection** - Verify MongoDB URI and network access
3. **Queue not processing** - Check notification queue status endpoint

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

### Health Check
```bash
curl http://localhost:3000/health
```

## 🎯 Benefits for Your Service

### For Elderly Users
- **Clear communication** about ride status
- **Timely reminders** for pickup times
- **Emergency support** when needed
- **Accessibility options** (large text, voice calls)

### For Caregivers
- **Real-time updates** about loved ones' rides
- **Emergency notifications** for safety
- **Ride tracking** and status monitoring
- **Communication preferences** management

### For Your Organization
- **Automated operations** reduce manual work
- **Improved safety** with emergency alerts
- **Better user experience** with timely updates
- **Scalable system** handles multiple rides simultaneously

## 🔮 Future Enhancements

### Planned Features
- **Voice calls** for users who prefer phone communication
- **Multi-language support** (Spanish, French, etc.)
- **Integration with medical alert systems**
- **Advanced analytics** and reporting
- **Mobile app** for real-time updates

### Integration Possibilities
- **GPS tracking** for real-time location updates
- **Weather alerts** for ride scheduling
- **Medical appointment** integration
- **Caregiver portal** for ride management

---

**DispatchBot - Making transportation accessible and safe for everyone**

*Built specifically for your elderly care ride service with your exact data format and status codes.* 