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
// app.use(cors({ origin: '*' }));
app.use(cors({
  origin: ['https://ritik1109.github.io', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
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

function normalizePhone(phone) {
  return String(phone || '').trim().replace(/\D/g, '').slice(-10);
}

async function sendViaFast2SMS(phone, otp) {
  if (!FAST2SMS_API_KEY) throw new Error('Fast2SMS API key not configured');

  const response = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    {
      route: 'q',
      message: `Your verification OTP is ${otp}. Valid for 5 minutes. Do not share it.`,
      numbers: phone,
      flash: 0,
    },
    {
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (response?.data?.return !== true) {
    const errMsg = response?.data?.message || 'Fast2SMS rejected request';
    const statusCode = response?.data?.status_code;
    console.error(`Fast2SMS error: status_code=${statusCode}, message=${errMsg}`);
    throw new Error(`Fast2SMS: ${errMsg} (code: ${statusCode})`);
  }

  return response.data;
}

async function sendAdminNotificationSms(messageText) {
  if (!ADMIN_PHONE_NUMBER || !FAST2SMS_API_KEY) return;
  const phone = normalizePhone(ADMIN_PHONE_NUMBER);
  if (phone.length !== 10) {
    console.warn(`⚠️  ADMIN_PHONE_NUMBER "${ADMIN_PHONE_NUMBER}" is invalid. Skipping SMS.`);
    return;
  }
  try {
    await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      { route: 'q', message: messageText, numbers: phone, flash: 0 },
      {
        headers: { authorization: FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
  } catch (err) {
    console.error('[Admin SMS] Failed:', err.message);
  }
}

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────

// POST /api/auth/send-otp
app.post(
  '/api/auth/send-otp',
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length !== 10) {
      return res.status(400).json({ error: 'Invalid phone number. Must be 10 digits.' });
    }

    const now = Date.now();
    const RESEND_COOLDOWN = parseInt(process.env.OTP_RESEND_COOLDOWN_MS) || 30000;
    const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MS) || 300000;

    // Check resend cooldown
    const existingOtp = await Otp.findOne({ phone: normalizedPhone });
    if (existingOtp && now - existingOtp.lastSentAt < RESEND_COOLDOWN) {
      const waitSecs = Math.ceil((RESEND_COOLDOWN - (now - existingOtp.lastSentAt)) / 1000);
      return res.status(429).json({
        error: `Please wait ${waitSecs} seconds before requesting another OTP.`,
      });
    }

    const otp = generateOTP();

    await Otp.findOneAndUpdate(
      { phone: normalizedPhone },
      { otp, expiresAt: now + OTP_EXPIRY, lastSentAt: now, attempts: 0 },
      { upsert: true, new: true }
    );

    try {
      await sendViaFast2SMS(normalizedPhone, otp);
      console.log(`[OTP] Sent via Fast2SMS to ${normalizedPhone}`);
      return res.json({ success: true, message: 'OTP sent successfully' });
    } catch (smsErr) {
      console.warn(`[OTP:FALLBACK] SMS failed for ${normalizedPhone}: ${smsErr.message}`);
      const includeOtp =
        process.env.NODE_ENV !== 'production' ||
        process.env.OTP_INCLUDE_IN_RESPONSE === 'true';
      return res.json({
        success: true,
        message: 'OTP generated (SMS delivery failed).',
        ...(includeOtp && { otp }),
      });
    }
  })
);

// POST /api/auth/verify-otp
app.post(
  '/api/auth/verify-otp',
  asyncHandler(async (req, res) => {
    const { phone, otp, name, location, pinAddress } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    const stored = await Otp.findOne({ phone: normalizedPhone });
    if (!stored) return res.status(400).json({ error: 'OTP not sent or already used' });
    if (Date.now() > stored.expiresAt)
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    if (stored.otp !== String(otp).trim())
      return res.status(400).json({ error: 'Invalid OTP' });

    await Otp.deleteOne({ phone: normalizedPhone });

    let user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      user = await User.create({
        phone: normalizedPhone,
        name: name || 'User',
        location: location || '',
        pinAddress: pinAddress || '',
      });
    } else {
      if (name) user.name = name;
      if (location) user.location = location;
      if (pinAddress) user.pinAddress = pinAddress;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, phone: normalizedPhone, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user });
  })
);

// ─── USER ROUTES ───────────────────────────────────────────────────────────

// GET /api/user/profile
app.get(
  '/api/user/profile',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ phone: req.user.phone });
    if (!user)
      return res.status(404).json({ error: 'User not found. Please log in again.' });
    res.json({ user });
  })
);

// PUT /api/user/profile
app.put(
  '/api/user/profile',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name, location, pinAddress } = req.body;
    const user = await User.findOneAndUpdate(
      { phone: req.user.phone },
      { name, location, pinAddress },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  })
);

// ─── BOOKING ROUTES ────────────────────────────────────────────────────────

// POST /api/bookings
app.post(
  '/api/bookings',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { appliance, serviceType, description, preferredDate, preferredTime } = req.body;

    if (!appliance || !serviceType || !preferredDate || !preferredTime) {
      return res.status(400).json({
        error: 'appliance, serviceType, preferredDate, and preferredTime are required.',
      });
    }

    const user = await User.findOne({ phone: req.user.phone });
    if (!user)
      return res.status(401).json({ error: 'User session expired. Log in again.' });

    const booking = await Booking.create({
      userId: user._id,
      userName: user.name,
      userPhone: user.phone,
      userLocation: user.location,
      userPinAddress: user.pinAddress,
      appliance,
      serviceType,
      description: description || '',
      preferredDate,
      preferredTime,
    });

    const adminMessage = `New Booking! ${user.name} (${user.phone}) booked ${serviceType} for ${appliance}. Date: ${preferredDate} at ${preferredTime}.`;
    sendAdminNotificationSms(adminMessage); // fire-and-forget

    res.status(201).json({ success: true, booking });
  })
);

// GET /api/bookings/my
app.get(
  '/api/bookings/my',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const myBookings = await Booking.find({ userPhone: req.user.phone }).sort({
      createdAt: -1,
    });
    res.json({ bookings: myBookings });
  })
);

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const admin = admins[username];
  if (!admin || admin.password !== password)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username, role: 'admin', name: admin.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ success: true, token, admin: { username, name: admin.name } });
});

// GET /api/admin/bookings
app.get(
  '/api/admin/bookings',
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = status ? { status } : {};
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await Booking.countDocuments(filter);
    res.json({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
  })
);

// PUT /api/admin/bookings/:id
app.put(
  '/api/admin/bookings/:id',
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true, booking });
  })
);

// GET /api/admin/users
app.get(
  '/api/admin/users',
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  })
);

// GET /api/admin/stats
app.get(
  '/api/admin/stats',
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const [total, pending, confirmed, completed, rejected, users] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed' }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'rejected' }),
      User.countDocuments(),
    ]);
    res.json({ total, pending, confirmed, completed, rejected, users });
  })
);

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  });
});

// ─── ROOT ROUTE ───────────────────────────────────────────────────────────  ← ADD THIS
app.get('/', (req, res) => res.json({ message: '🔧 Appliance Service API is running' }));


// ─── 404 HANDLER ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ─── START SERVER ─────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so Render can detect the open port
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔐 Admin: username=admin, password=Admin@1234`);
  console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
});
