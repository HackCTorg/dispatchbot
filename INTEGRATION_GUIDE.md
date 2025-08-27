# 🔌 DispatchBot Integration Guide

## 🎯 Perfect Integration with Your Existing System

Your DispatchBot is designed to work **seamlessly** with your existing Mongoose models and data structure. No changes to your current system are required!

## 📊 Your Data Models (Exactly as You Have Them)

### Service Users (Elderly People)
```typescript
// Your existing Mongoose model - NO CHANGES NEEDED
const userSchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true },
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: String, required: true },
    race: { type: String, required: true, enum: ['black', 'white', 'asian', 'latino', 'native american', 'other', 'prefer not to say'] },
    maritalStatus: { type: String, required: true, enum: ['single', 'married', 'divorced', 'widowed', 'separated', 'other', 'prefer not to say'] },
    residence: {
        current: { type: String, required: false },
        last: { type: String, required: true }
    },
    income: {
        current: { type: String, required: false },
        last: { type: String, required: true }
    },
    serviceUserRole: { type: [String], required: true, enum: ['rider', 'caregiver', 'relative', 'guardian', 'case manager', 'other'] },
    veteranStatus: { type: String, required: false, enum: ['veteran', 'not veteran', 'prefer not to say'] },
    disabilityStatus: { type: String, required: false, enum: ['yes', 'no', 'prefer not to say'] }
}, { timestamps: true });
```

### Service Providers (Drivers/Staff)
```typescript
// Your existing Mongoose model - NO CHANGES NEEDED
const serviceProviderSchema = new mongoose.Schema({
  uuid: { type: Number, required: true, unique: true },
  fullName: { type: String, required: true },
  title: { type: String, required: true },
  organization: { type: String, required: true, enum: ['EASTCONN', 'Generations Health', 'other'] },
  phone: { type: String, required: true },
  role: { type: String, required: true, enum: ['Transport Broker', 'Staff', 'Fleet Manager', 'Driver', 'Admin'] },
  specializations: { type: String, enum: ['Caseworker', 'Nutritionist', 'Intake'] },
  faxPhone: { type: String, required: false }
}, { timestamps: true });
```

### Ride Requests (Your Exact Format)
```typescript
// Your existing ride request structure - NO CHANGES NEEDED
interface RideRequest {
  rideRequestUuid: string;
  serviceUserUuid: string;
  pickupBaseAddress: string;
  dropoffBaseAddress: string;
  pickupLocationUuid: string;
  dropoffLocationUuid: string;
  assignedVehicleUuid?: string;
  assignedDriverUuid?: string;
  roundtrip: boolean;
  pickupRequestedDatetime: Date;
  dropoffRequestedDatetime: Date;
  rideStartedActualDatetime?: Date;
  pickupActualDatetime?: Date;
  dropoffActualDatetime?: Date;
  roundtripReturningActualDatetime?: Date;
  roundtripCompletedActualDatetime?: Date;
  rideCompleteRequestedDatetime?: Date;
  rideCompletedActualDatetime?: Date;
  rideStatus: RideRequestStatus; // Your exact status codes
  purposeOfTrip: string;
  rideRequestStatus: string;
  notes?: string;
}
```

## 🔄 How Integration Works

### 1. **Your System Creates Data** (No Changes)
```typescript
// Your existing code - DispatchBot automatically detects this
const newUser = await User.create({
  uuid: "USER_001",
  fullname: "Margaret Johnson",
  phone: "+1234567890",
  dob: "1945-03-15",
  race: "white",
  maritalStatus: "widowed",
  serviceUserRole: ["rider"],
  // ... other fields
});

const newProvider = await ServiceProvider.create({
  uuid: 1001,
  fullName: "John Driver",
  title: "Transportation Specialist",
  organization: "EASTCONN",
  phone: "+1987654321",
  role: "Driver"
});
```

### 2. **DispatchBot Automatically Integrates**
```typescript
// DispatchBot reads from your existing collections
const userPrefsManager = new UserPrefsManager(db);

// Get user from your existing 'users' collection
const user = await userPrefsManager.getServiceUser("USER_001");

// Get provider from your existing 'serviceproviders' collection
const provider = await userPrefsManager.getServiceProvider(1001);
```

### 3. **Automatic SMS Notifications**
```typescript
// When you update ride status, DispatchBot automatically sends SMS
PUT /api/rides/RIDE_123/status
{
  "status": 300,  // Your status code for "Rider Picked Up"
  "reason": null
}

// DispatchBot automatically:
// 1. Updates your ride request
// 2. Sends SMS to elderly person: "You have been picked up!"
// 3. Logs the event
// 4. Updates notification queue
```

## 🚀 Getting Started (5 Minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
cp env.example .env
# Edit .env with your MongoDB connection and Twilio credentials
```

### Step 3: Start DispatchBot
```bash
npm run dev
```

### Step 4: Test Integration
```bash
node example-usage.js
```

## 📱 API Endpoints (All Work with Your Data)

### User Management
```typescript
// Create service user (uses your exact model)
POST /api/users
{
  "uuid": "USER_001",
  "fullname": "Margaret Johnson",
  "phone": "+1234567890",
  "dob": "1945-03-15",
  "race": "white",
  "maritalStatus": "widowed",
  "serviceUserRole": ["rider"],
  "veteranStatus": "not veteran",
  "disabilityStatus": "yes"
}

// Get user preferences
GET /api/users/USER_001/preferences

// Update user preferences
PUT /api/users/USER_001/preferences
{
  "notificationPreferences": { "sms": true, "email": false },
  "emergencyContacts": [
    {
      "name": "Jane Smith",
      "phoneNumber": "+1234567890",
      "relationship": "Daughter",
      "priority": "primary"
    }
  ]
}
```

### Provider Management
```typescript
// Create service provider (uses your exact model)
POST /api/providers
{
  "uuid": 1001,
  "fullName": "John Driver",
  "title": "Transportation Specialist",
  "organization": "EASTCONN",
  "phone": "+1987654321",
  "role": "Driver"
}

// Get provider preferences
GET /api/providers/1001/preferences

// Update provider preferences
PUT /api/providers/1001/preferences
{
  "availability": {
    "days": [1, 2, 3, 4, 5],
    "hours": { "start": "08:00", "end": "18:00" },
    "isAvailable": true
  },
  "specializations": ["wheelchair", "oxygen"]
}
```

### Ride Management
```typescript
// Create ride request (uses your exact format)
POST /api/rides
{
  "rideRequestUuid": "RIDE_123",
  "serviceUserUuid": "USER_001",
  "pickupBaseAddress": "123 Main St",
  "dropoffBaseAddress": "456 Oak Ave",
  "rideStatus": 0,  // Your status code
  "roundtrip": true,
  "purposeOfTrip": "Medical appointment"
}

// Update ride status (triggers automatic SMS)
PUT /api/rides/RIDE_123/status
{
  "status": 100,  // Your status code for "Confirmed"
  "reason": null
}

// Assign driver
POST /api/rides/RIDE_123/assign
{
  "driverUuid": 1001
}
```

## 🔍 Database Collections (Uses Your Existing Ones)

### Your Collections (No Changes)
- `users` - Your service users
- `serviceproviders` - Your drivers/staff
- `rideRequests` - Your ride requests

### New Collections (Created by DispatchBot)
- `userPreferences` - Communication preferences
- `serviceProviderPreferences` - Driver preferences
- `notificationQueue` - SMS notification queue
- `rideEvents` - Ride lifecycle events
- `messageTemplates` - SMS message templates

## 📊 Real-World Example

### Scenario: Elderly Person Requests Ride

#### 1. **Your System Creates Ride Request**
```typescript
// Your existing code - no changes needed
const rideRequest = await RideRequest.create({
  rideRequestUuid: "RIDE_2024_001",
  serviceUserUuid: "USER_001",
  pickupBaseAddress: "123 Main St, Anytown",
  dropoffBaseAddress: "456 Oak Ave, Anytown",
  rideStatus: 0,  // In Progress
  roundtrip: true,
  purposeOfTrip: "Doctor appointment"
});
```

#### 2. **DispatchBot Automatically Detects**
```typescript
// DispatchBot automatically:
// - Stores ride request
// - Creates "REQUEST_CREATED" event
// - Sends SMS: "Your ride request has been received!"
// - Queues pickup reminder (15 min before)
```

#### 3. **Your System Assigns Driver**
```typescript
// Your existing code - no changes needed
await RideRequest.updateOne(
  { rideRequestUuid: "RIDE_2024_001" },
  { assignedDriverUuid: 1001 }
);
```

#### 4. **DispatchBot Automatically Notifies**
```typescript
// DispatchBot automatically:
// - Creates "DRIVER_ASSIGNED" event
// - Sends SMS to elderly: "Driver John assigned!"
// - Sends SMS to driver: "New ride request assigned"
```

#### 5. **Ride Progress Updates**
```typescript
// Your system updates status
PUT /api/rides/RIDE_2024_001/status
{ "status": 300 }  // Rider picked up

// DispatchBot automatically:
// - Updates ride status
// - Sends SMS: "You have been picked up!"
// - Logs the event
```

## 🚨 Emergency Handling

### Automatic Emergency Response
```typescript
// When emergency detected:
await sendEmergencyNotification(
  "USER_001",
  "Medical emergency during ride"
);

// DispatchBot automatically:
// 1. Sends urgent SMS to elderly person
// 2. Notifies all emergency contacts
// 3. Alerts support team
// 4. Updates ride status to interrupted (209)
// 5. Logs emergency for follow-up
```

### Emergency Contact Setup
```typescript
// Set up emergency contacts using your existing user UUIDs
PUT /api/users/USER_001/preferences
{
  "emergencyContacts": [
    {
      "name": "Jane Smith",
      "phoneNumber": "+1234567890",
      "relationship": "Daughter",
      "priority": "primary"
    },
    {
      "name": "Robert Johnson",
      "phoneNumber": "+1234567891",
      "relationship": "Son",
      "priority": "secondary"
    }
  ]
}
```

## 🔧 Customization Options

### Message Templates
```typescript
// Customize SMS messages for your organization
await templateManager.createTemplate({
  name: 'EASTCONN Welcome',
  category: 'general',
  language: 'en',
  template: 'Welcome to EASTCONN transportation! Your ride is scheduled for {pickupTime}.',
  variables: ['pickupTime']
});
```

### User Preferences
```typescript
// Set communication preferences per elderly person
PUT /api/users/USER_001/preferences
{
  "notificationPreferences": {
    "sms": true,
    "email": false
  },
  "rideUpdates": {
    "requestConfirmation": true,
    "driverAssigned": true,
    "pickupReminder": true,
    "delays": true
  },
  "accessibility": {
    "requiresLargeText": true,
    "requiresVoiceCalls": false,
    "preferredContactTime": "business-hours"
  }
}
```

## 📈 Monitoring & Analytics

### Real-time Dashboard
```typescript
// Get system status
GET /api/dispatchbot/status

// Get notification queue status
GET /api/notifications/queue/status

// Get ride notification statistics
GET /api/rides/RIDE_123/notifications
```

### Key Metrics
- SMS delivery success rate
- Notification response times
- Queue processing speed
- Emergency response times
- Ride completion rates

## 🆘 Troubleshooting

### Common Issues & Solutions

#### 1. **SMS Not Sending**
```bash
# Check Twilio credentials
curl http://localhost:3000/api/dispatchbot/status

# Verify webhook URLs in Twilio console
# Check .env file for TWILIO_* variables
```

#### 2. **Database Connection Issues**
```bash
# Test MongoDB connection
curl http://localhost:3000/health

# Verify MONGODB_URI in .env file
# Check MongoDB is running
```

#### 3. **Notifications Not Processing**
```bash
# Check queue status
curl http://localhost:3000/api/notifications/queue/status

# Verify notification queue is running
# Check for error logs
```

## 🎯 Benefits for Your Organization

### For EASTCONN & Generations Health
- **No system changes required** - Works with existing data
- **Automated operations** - Reduces manual work
- **Improved safety** - Emergency alerts and monitoring
- **Better user experience** - Timely updates for elderly
- **Scalable system** - Handles multiple rides simultaneously

### For Elderly Users
- **Clear communication** about ride status
- **Timely reminders** for pickup times
- **Emergency support** when needed
- **Accessibility options** (large text, voice calls)

### For Caregivers
- **Real-time updates** about loved ones' rides
- **Emergency notifications** for safety
- **Ride tracking** and status monitoring

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

## 📞 Support

### Getting Help
- **Documentation** - Check this guide and README
- **Example Code** - Run `example-usage.js`
- **API Testing** - Use the health check endpoints
- **Logs** - Check console output for errors

### Emergency Support
For critical issues affecting production:
- **Email** - support@your-org.com
- **Phone** - +1-XXX-XXX-XXXX
- **Slack** - #dispatchbot-support

---

## 🎉 **You're Ready to Go!**

Your DispatchBot is now perfectly integrated with your existing system. It will:

✅ **Automatically detect** your service users and providers  
✅ **Work with your exact** data models and field names  
✅ **Handle your status codes** (0, 100, 200, 300, etc.)  
✅ **Send SMS notifications** via Twilio  
✅ **Manage emergency situations** automatically  
✅ **Provide real-time monitoring** and analytics  

**No changes to your existing code required!** Just start the DispatchBot and it will begin working with your data immediately.

---

**DispatchBot - Making transportation accessible and safe for everyone**

*Built specifically for EASTCONN and Generations Health with your exact data structure.* 