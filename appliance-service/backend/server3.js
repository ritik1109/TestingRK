// Load environment variables only if not in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'appliance_service_secret_2024';
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const ADMIN_PHONE_NUMBER = process.env.ADMIN_PHONE_NUMBER || '';
const MONGO_URI = process.env.MONGO_URI;

// ─── ENV VALIDATION ────────────────────────────────────────────────────────
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in environment variables!');
  process.exit(1);
}
if (!FAST2SMS_API_KEY) {
  console.warn('⚠️  FAST2SMS_API_KEY is missing. SMS will not be sent.');
}

// Enable CORS for all origins (Perfect for connecting Render to GitHub Pages)
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// ─── ASYNC HANDLER WRAPPER ─────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── MONGODB CONNECTION ────────────────────────────────────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () =>
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...')
);
mongoose.connection.on('reconnected', () =>
  console.log('✅ MongoDB reconnected.')
);

// ─── MONGOOSE MODELS ───────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: { type: String, default: 'User' },
  phone: { type: String, required: true, unique: true },
  location: { type: String, default: '' },
  pinAddress: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', UserSchema);

const BookingSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userPhone: String,
  userLocation: String,
  userPinAddress: String,
  appliance: String,
  serviceType: String,
  description: String,
  preferredDate: String,
  preferredTime: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Booking = mongoose.model('Booking', BookingSchema);

const OtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  otp: String,
  expiresAt: Number,
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Number, default: 0 },
});
const Otp = mongoose.model('Otp', OtpSchema);

// In-memory admin store (extend to DB if needed)
const admins = {
  admin: { password: 'Admin@1234', name: 'Super Admin' },
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}