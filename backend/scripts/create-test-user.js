const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/youtube-mate');
    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'demo@example.com' });
    
    if (existingUser) {
      console.log('Test user already exists:', existingUser.email);
      console.log('Current plan:', existingUser.plan);
      process.exit(0);
    }

    // Create test user
    const testUser = new User({
      email: 'demo@example.com',
      password: 'demo123456', // This will be hashed automatically
      name: 'Demo User',
      plan: 'free',
      isEmailVerified: true,
      authProvider: 'local'
    });

    await testUser.save();
    console.log('Test user created successfully:');
    console.log('Email: demo@example.com');
    console.log('Password: demo123456');
    console.log('Plan: free');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestUser();
