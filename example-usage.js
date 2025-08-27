// Example usage of DispatchBot for Elderly Care Ride Service
// This script demonstrates how to integrate with your existing ride request system
// Updated to match your exact Mongoose models

const axios = require('axios');

// Configuration
const API_BASE = 'http://localhost:3000';

// Example data structures matching your exact models
const exampleServiceUser = {
  uuid: "USER_001",
  fullname: "John Smith",
  phone: "+1234567890",
  dob: "1940-05-15",
  race: "white",
  maritalStatus: "married",
  residence: { current: "123 Main St", last: "123 Main St" },
  income: { current: "retired", last: "retired" },
  serviceUserRole: ["rider"],
  veteranStatus: "veteran",
  disabilityStatus: "yes"
};

const exampleServiceProvider = {
  uuid: 1001,
  fullName: "Mike Driver",
  title: "Transportation Specialist",
  organization: "EASTCONN",
  phone: "+1987654321",
  role: "Driver"
};

const exampleUserPreferences = {
  notificationPreferences: { sms: true, email: false },
  emergencyContacts: [
    {
      name: "Jane Smith",
      phoneNumber: "+1234567890",
      relationship: "Daughter",
      priority: "primary"
    }
  ],
  roundtripUpdates: true,
  mobilityAssistance: true,
  communicationAssistance: false,
  specialNeeds: ["wheelchair access"]
};

const exampleProviderPreferences = {
  availability: {
    days: [1, 2, 3, 4, 5], // Monday to Friday
    hours: { start: "08:00", end: "18:00" },
    isAvailable: true
  },
  specializations: ["wheelchair", "oxygen"],
  emergencyAlerts: true,
  systemMaintenance: false
};

// 🎯 **SIMPLIFIED USAGE - Now Fully Automatic!**

// 1. **Set up user preferences** (one-time setup)
async function setupUserPreferences() {
  try {
    console.log('🔧 Setting up user preferences...');
    
    const response = await axios.put(`${API_BASE}/api/users/USER_001/preferences`, exampleUserPreferences);
    console.log('✅ User preferences set:', response.data);
    
  } catch (error) {
    console.error('❌ Error setting user preferences:', error.response?.data || error.message);
    throw error;
  }
}

// 2. **Set up driver preferences** (one-time setup)
async function setupDriverPreferences() {
  try {
    console.log('🔧 Setting up driver preferences...');
    
    const response = await axios.put(`${API_BASE}/api/drivers/1001/preferences`, exampleProviderPreferences);
    console.log('✅ Driver preferences set:', response.data);
    
  } catch (error) {
    console.error('❌ Error setting driver preferences:', error.response?.data || error.message);
    throw error;
  }
}

// 3. **Send emergency notification** (when needed)
async function sendEmergencyAlert() {
  try {
    console.log('🚨 Sending emergency alert...');
    
    const response = await axios.post(`${API_BASE}/api/notifications/emergency`, {
      recipient: "USER_001",
      message: "Medical emergency during ride - immediate assistance needed"
    });
    
    console.log('✅ Emergency alert sent:', response.data);
    
  } catch (error) {
    console.error('❌ Error sending emergency alert:', error.response?.data || error.message);
    throw error;
  }
}

// 4. **Check system status** (monitoring)
async function checkSystemStatus() {
  try {
    console.log('📊 Checking system status...');
    
    const response = await axios.get(`${API_BASE}/api/dispatchbot/status`);
    console.log('✅ System status:', response.data);
    
  } catch (error) {
    console.error('❌ Error checking system status:', error.response?.data || error.message);
    throw error;
  }
}

// 5. **Check notification queue** (monitoring)
async function checkNotificationQueue() {
  try {
    console.log('📋 Checking notification queue...');
    
    const response = await axios.get(`${API_BASE}/api/notifications/queue/status`);
    console.log('✅ Queue status:', response.data);
    
  } catch (error) {
    console.error('❌ Error checking queue status:', error.response?.data || error.message);
    throw error;
  }
}

// 🎉 **That's It! Everything Else is Automatic!**

// **What happens automatically when you use your ride app:**
// 1. Create ride → DispatchBot automatically detects and sends SMS
// 2. Update status → DispatchBot automatically detects and sends SMS  
// 3. Assign driver → DispatchBot automatically detects and sends SMS
// 4. Assign vehicle → DispatchBot automatically detects and sends SMS
// 5. Complete ride → DispatchBot automatically detects and sends SMS

// **Complete setup and test example**
async function runCompleteSetup() {
  try {
    console.log('🚀 Starting DispatchBot setup and test...\n');
    
    // 1. Set up user preferences
    await setupUserPreferences();
    console.log('');
    
    // 2. Set up driver preferences  
    await setupDriverPreferences();
    console.log('');
    
    // 3. Check system status
    await checkSystemStatus();
    console.log('');
    
    // 4. Check notification queue
    await checkNotificationQueue();
    console.log('');
    
    // 5. Test emergency alert
    await sendEmergencyAlert();
    console.log('');
    
    console.log('🎉 Setup complete! DispatchBot is now fully automatic!');
    console.log('');
    console.log('📱 **To test automatic SMS:**');
    console.log('   1. Create a ride in your ride app (no changes needed)');
    console.log('   2. Update the ride status in your ride app (no changes needed)');
    console.log('   3. Watch DispatchBot automatically send SMS!');
    console.log('');
    console.log('🔍 **Monitor everything:**');
    console.log('   - Check status: GET /api/dispatchbot/status');
    console.log('   - Check queue: GET /api/notifications/queue/status');
    console.log('   - Emergency: POST /api/notifications/emergency');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

// Export functions for use
module.exports = {
  setupUserPreferences,
  setupDriverPreferences,
  sendEmergencyAlert,
  checkSystemStatus,
  checkNotificationQueue,
  runCompleteSetup
};

// Run setup if this file is executed directly
if (require.main === module) {
  runCompleteSetup();
} 