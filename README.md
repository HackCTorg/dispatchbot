# 🚀 DispatchBot - Automatic SMS Dispatch System

> **Fully automatic SMS notifications for elderly care ride services**  
> *Now with real-time database change detection - zero manual API calls needed!*

## ✨ **What's New - Fully Automatic!**

DispatchBot now uses **MongoDB Change Streams** to automatically detect every change in your ride request database and send SMS notifications in real-time. **No more manual API calls needed!**

### **🆕 Automatic Detection Features**
- ✅ **Real-time status changes** - Detects every ride status update automatically
- ✅ **New ride requests** - Automatically sends confirmation SMS when rides are created
- ✅ **Driver assignments** - Automatically notifies when drivers are assigned
- ✅ **Vehicle assignments** - Automatically notifies when vehicles are assigned
- ✅ **Emergency alerts** - Immediate caregiver notification system
- ✅ **Pickup reminders** - Automatic reminders 15 minutes before pickup
- ✅ **Delay notifications** - Alerts when rides are running late

## 🎯 **Key Benefits**

- **🚫 Zero Code Changes** - Works with your existing ride app immediately
- **⚡ Real-time Detection** - MongoDB Change Streams watch your database
- **📱 Automatic SMS** - Every status change triggers appropriate notifications
- **🚨 Emergency Ready** - Immediate caregiver and support team alerts
- **🔍 Full Monitoring** - Real-time status and queue monitoring
- **📊 Analytics** - Track SMS delivery and system performance

## 🏗️ **Architecture**

```
Your Ride App Database ←→ DispatchBot ←→ Twilio SMS
     (MongoDB)           (Change Streams)   (Users)
```

### **Core Components**
- **🔄 Change Stream Monitor** - Watches your database for real-time changes
- **📱 SMS Manager** - Handles Twilio SMS sending and delivery tracking
- **⚙️ Preferences Manager** - Manages user and driver communication preferences
- **🚨 Emergency Handler** - Immediate emergency notification system
- **📋 Queue Manager** - Prioritized notification queue with retry logic

## 🚀 **Quick Start (5 Minutes)**

### **1. Install Dependencies**
```bash
npm install
```

### **2. Configure Environment**
```bash
# Copy the config file
cp dispatchbot-config.env .env

# Edit .env with your actual values:
# - MONGODB_URI (same as your ride app)
# - TWILIO_ACCOUNT_SID (same as your ride app)
# - TWILIO_AUTH_TOKEN (same as your ride app)
# - TWILIO_FROM_NUMBER (same as your ride app)
```

### **3. Start DispatchBot**
```bash
npm run dev
```

### **4. Set Up Preferences (One-time)**
```bash
# Set user preferences
curl -X PUT http://localhost:3000/api/users/USER_001/preferences \
  -H "Content-Type: application/json" \
  -d '{"notificationPreferences": {"sms": true}}'

# Set driver preferences  
curl -X PUT http://localhost:3000/api/drivers/1001/preferences \
  -H "Content-Type: application/json" \
  -d '{"availability": {"isAvailable": true}}'
```

### **5. Test It!**
```bash
# Check if it's running
curl http://localhost:3000/health

# Check status
curl http://localhost:3000/api/dispatchbot/status
```

## 🔄 **How It Works (Fully Automatic)**

### **Before (Manual API Calls)**
```javascript
// Your ride app had to call DispatchBot API
await fetch('/api/rides/1001/status', {
  method: 'PUT',
  body: JSON.stringify({ status: 300 })
});
```

### **Now (Fully Automatic)**
```javascript
// Your ride app just updates the database (NO CHANGES NEEDED!)
await RideRequest.updateOne(
  { uuid: 1001 },
  { rideStatus: 300 }  // Change to "Rider Picked Up"
);

// DispatchBot automatically detects this and sends SMS!
```

## 📱 **Automatic SMS Triggers**

| **Your Status Code** | **DispatchBot Action** | **SMS Sent** | **Detection** |
|---------------------|------------------------|---------------|---------------|
| `0` (In Progress) | Creates event | "Ride request received" | ✅ Automatic |
| `100` (Confirmed) | Creates event | "Ride confirmed" | ✅ Automatic |
| `200` (Started) | Creates event | "Ride started" | ✅ Automatic |
| `300` (Picked Up) | Creates event | "You've been picked up!" | ✅ Automatic |
| `400` (Dropped Off) | Creates event | "You've been dropped off" | ✅ Automatic |
| `500` (Complete) | Creates event | "Ride complete" | ✅ Automatic |

## 🚨 **Emergency Handling**

### **Send Emergency Alert**
```bash
POST /api/notifications/emergency
{
  "recipient": "USER_001",
  "message": "Medical emergency during ride"
}
```

### **DispatchBot Automatically**
1. **Sends urgent SMS** to elderly person
2. **Notifies emergency contacts** (caregivers, family)
3. **Alerts support team**
4. **Updates ride status** to interrupted (209)
5. **Logs everything** for follow-up

## 🔍 **Monitoring & Control**

### **System Status**
```bash
GET /api/dispatchbot/status
# Shows: Queue status, SMS sent, system health, change streams active
```

### **Notification Queue**
```bash
GET /api/notifications/queue/status
# Shows: Pending SMS, failed messages, success rate
```

### **Health Check**
```bash
GET /health
# Shows: System health and uptime
```

## 📊 **API Endpoints (Simplified)**

### **Essential Endpoints (Only What You Need)**
- `GET /health` - Health check
- `POST /api/notifications/emergency` - Emergency alerts
- `GET /api/notifications/queue/status` - Queue monitoring
- `GET /api/dispatchbot/status` - System status
- `GET /api/users/:uuid/preferences` - Get user preferences
- `PUT /api/users/:uuid/preferences` - Update user preferences
- `GET /api/drivers/:uuid/preferences` - Get driver preferences
- `PUT /api/drivers/:uuid/preferences` - Update driver preferences

### **Removed (No Longer Needed)**
- ❌ `POST /api/rides` - Ride creation (automatic detection)
- ❌ `PUT /api/rides/:uuid/status` - Status updates (automatic detection)
- ❌ `POST /api/rides/:uuid/assign` - Driver assignment (automatic detection)
- ❌ `POST /api/rides/:uuid/vehicle` - Vehicle assignment (automatic detection)

## 🧪 **Testing the Automatic System**

### **1. Create a Test Ride in Your App**
```javascript
// In your ride request app (no changes needed!)
const testRide = await RideRequest.create({
  uuid: 9999,
  serviceUserUuid: "TEST_USER",
  pickupAddress: "123 Test St",
  dropOffAddress: "456 Test Ave",
  rideStatus: 0,
  roundTrip: false,
  purpose: "Testing DispatchBot"
});

// DispatchBot automatically detects this and sends SMS!
```

### **2. Update Status in Your App**
```javascript
// In your ride request app (no changes needed!)
await RideRequest.updateOne(
  { uuid: 9999 },
  { rideStatus: 300 }  // Change to "Rider Picked Up"
);

// DispatchBot automatically detects this and sends SMS!
```

### **3. Monitor Everything**
```bash
# Check system status
curl http://localhost:3000/api/dispatchbot/status

# Check notification queue
curl http://localhost:3000/api/notifications/queue/status
```

## 🔧 **Configuration**

### **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | Yes | - |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | Yes | - |
| `TWILIO_FROM_NUMBER` | Twilio phone number | Yes | - |
| `TWILIO_WEBHOOK_URL` | Webhook base URL | No | - |

### **Database Requirements**
- **MongoDB 3.6+** (for Change Streams support)
- **Same database** as your ride request app
- **Collections**: `users`, `serviceproviders`, `riderequests`

## 🆘 **Troubleshooting**

### **SMS Not Sending?**
- Check Twilio credentials in `.env`
- Verify phone numbers are in correct format (+1234567890)
- Check DispatchBot logs for errors
- Verify change streams are active in console

### **Database Connection Issues?**
- Verify MongoDB is running
- Check `MONGODB_URI` in `.env`
- Ensure DispatchBot connects to same database as your ride app
- Check if MongoDB supports Change Streams (MongoDB 3.6+)

### **Change Streams Not Working?**
- Check MongoDB version (needs 3.6+)
- Verify database user has permissions for change streams
- Check console for "⚠️ Falling back to manual API detection"
- DispatchBot will still work with manual API calls

## 🎉 **You're Ready! (Now Fully Automatic!)**

Your DispatchBot is now **perfectly integrated** and **fully automatic**! It will:

1. **Watch your database** for ride changes in real-time
2. **Send automatic SMS** for every status update (no API calls needed!)
3. **Handle emergencies** immediately
4. **Provide real-time monitoring** and analytics

**No changes to your existing code required!** Just start DispatchBot and it will automatically detect every change in your ride request app and send the appropriate SMS notifications.

---

**DispatchBot - Making transportation accessible and safe for everyone**

*Now with fully automatic database change detection!* 