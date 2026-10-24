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
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { isValidBookingDate, normalizePhone, validText } = require('./lib/validation');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const ADMIN_PHONE_NUMBER = process.env.ADMIN_PHONE_NUMBER || '';
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';
const isProduction = process.env.NODE_ENV === 'production';

// ─── ENV VALIDATION ────────────────────────────────────────────────────────
const missingConfig = [];
if (!MONGO_URI) missingConfig.push('MONGO_URI');
if (!JWT_SECRET || JWT_SECRET.length < 32) missingConfig.push('JWT_SECRET (at least 32 characters)');
// Local customer sign-in can run without admin credentials; production requires a configured admin.
const adminCredentialsConfigured = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD_HASH);
if (isProduction || ADMIN_USERNAME || ADMIN_PASSWORD_HASH) {
  if (!ADMIN_USERNAME) missingConfig.push('ADMIN_USERNAME');
  if (!ADMIN_PASSWORD_HASH || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(ADMIN_PASSWORD_HASH)) {
    missingConfig.push('ADMIN_PASSWORD_HASH (bcrypt hash)');
  }
}
try {
  new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Kolkata',
  });
} catch {
  missingConfig.push('BUSINESS_TIME_ZONE (valid IANA time zone)');
}
if (isProduction && !process.env.CORS_ORIGINS) missingConfig.push('CORS_ORIGINS');
if (missingConfig.length) {
  console.error(`❌ Missing or invalid required configuration: ${missingConfig.join(', ')}`);
  process.exit(1);
}
if (!FAST2SMS_API_KEY) {
  console.warn('⚠️  FAST2SMS_API_KEY is missing. SMS will not be sent.');
}

const allowedOrigins = (process.env.CORS_ORIGINS || [
  'https://ritik1109.github.io',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:5500',
].join(',')).split(',').map((origin) => origin.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(bodyParser.json({ limit: '16kb', strict: true }));
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)
    && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ error: 'A JSON object is required.' });
  }
  next();
});

const requestLimits = new Map();
// Apply a per-process fallback limiter; production deployments with multiple instances need a shared store.
function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  return (req, res, next) => {
    const now = Date.now();
    const requestKey = `${req.path}:${key(req)}`;
    let entry = requestLimits.get(requestKey);
    if (!entry || now >= entry.resetAt) {
      if (requestLimits.size >= 10000) {
        for (const [storedKey, stored] of requestLimits) {
          if (now >= stored.resetAt) requestLimits.delete(storedKey);
        }
      }
      if (!requestLimits.has(requestKey) && requestLimits.size >= 10000) {
        return res.status(503).json({ error: 'Request protection is temporarily busy. Try again shortly.' });
      }
      entry = { count: 0, resetAt: now + windowMs };
      requestLimits.set(requestKey, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// ─── ASYNC HANDLER WRAPPER ─────────────────────────────────────────────────
// Route async failures through Express so every error receives the same safe response.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── MONGODB CONNECTION ────────────────────────────────────────────────────
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
  otpHash: String,
  expiresAt: Number,
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Number, default: 0 },
});
const Otp = mongoose.model('Otp', OtpSchema);

// ─── HELPERS ───────────────────────────────────────────────────────────────
// Use a cryptographically secure random generator for six-digit verification codes.
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Store a keyed digest so a database read does not reveal live OTP values.
function hashOTP(phone, otp) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${phone}:${otp}`).digest('hex');
}

// Compare OTP digests without leaking the matching prefix through timing.
function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Send a verification code through the configured SMS provider or report delivery failure.
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

// Best-effort booking notifications must not block the customer request.
async function sendAdminNotificationSms(messageText) {
  if (!ADMIN_PHONE_NUMBER || !FAST2SMS_API_KEY) return;
  const phone = normalizePhone(ADMIN_PHONE_NUMBER);
  if (phone.length !== 10) {
    console.warn('⚠️  ADMIN_PHONE_NUMBER is invalid. Skipping SMS.');
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
// Authenticate customer-only routes and ensure the verified token has the user role.
function authMiddleware(req, res, next) {
  const [scheme, token, extra] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra) return res.status(401).json({ error: 'Bearer token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (req.user.role !== 'user' || !req.user.phone) {
      return res.status(403).json({ error: 'User access required' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Restrict administrative routes to short-lived admin tokens.
function adminMiddleware(req, res, next) {
  const [scheme, token, extra] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token || extra) return res.status(401).json({ error: 'Bearer token required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, key: (req) => `${req.ip}:${normalizePhone(req.body?.phone)}` }),
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length !== 10) {
      return res.status(400).json({ error: 'Invalid phone number. Must be 10 digits.' });
    }

    const now = Date.now();
    const RESEND_COOLDOWN = Number(process.env.OTP_RESEND_COOLDOWN_MS) || 30000;
    const OTP_EXPIRY = Number(process.env.OTP_EXPIRY_MS) || 300000;

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
      { otpHash: hashOTP(normalizedPhone, otp), expiresAt: now + OTP_EXPIRY, lastSentAt: now, attempts: 0 },
      { upsert: true, new: true }
    );

    try {
      await sendViaFast2SMS(normalizedPhone, otp);
      console.log('[OTP] SMS sent successfully.');
      return res.json({ success: true, message: 'OTP sent successfully' });
    } catch (smsErr) {
      const includeDevelopmentOtp =
        !isProduction && process.env.OTP_INCLUDE_IN_RESPONSE === 'true';
      if (includeDevelopmentOtp) {
        return res.json({ success: true, message: 'Development OTP generated.', otp });
      }
      await Otp.deleteOne({ phone: normalizedPhone });
      console.error(`[OTP] SMS delivery failed: ${smsErr.message}`);
      return res.status(503).json({ error: 'Unable to deliver a verification code. Please try again later.' });
    }
  })
);

// POST /api/auth/verify-otp
app.post(
  '/api/auth/verify-otp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: (req) => `${req.ip}:${normalizePhone(req.body?.phone)}` }),
  asyncHandler(async (req, res) => {
    const { phone, otp, name, location, pinAddress } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedOtp = typeof otp === 'string' ? otp.trim() : '';

    if (!normalizedPhone || !/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ error: 'A valid phone number and six-digit OTP are required.' });
    }
    if ((name != null && (typeof name !== 'string' || name.length > 100))
      || (location != null && (typeof location !== 'string' || location.length > 120))
      || (pinAddress != null && (typeof pinAddress !== 'string' || pinAddress.length > 300))) {
      return res.status(400).json({ error: 'Profile fields exceed the allowed length.' });
    }

    const stored = await Otp.findOne({ phone: normalizedPhone });
    if (!stored) return res.status(400).json({ error: 'OTP not sent or already used' });
    if (Date.now() > stored.expiresAt)
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    if (stored.attempts >= 5) {
      await Otp.deleteOne({ phone: normalizedPhone });
      return res.status(429).json({ error: 'Too many incorrect codes. Request a new OTP.' });
    }
    if (!stored.otpHash || !constantTimeEqual(stored.otpHash, hashOTP(normalizedPhone, normalizedOtp))) {
      await Otp.updateOne(
        { phone: normalizedPhone, otpHash: stored.otpHash, attempts: { $lt: 5 } },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const consumedOtp = await Otp.findOneAndDelete({
      phone: normalizedPhone,
      otpHash: stored.otpHash,
      expiresAt: { $gt: Date.now() },
      attempts: { $lt: 5 },
    });
    if (!consumedOtp) return res.status(400).json({ error: 'OTP has expired or already been used.' });

    let user = await User.findOne({ phone: normalizedPhone });
    const isNewUser = !user;
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
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    res.json({ success: true, token, user, isNewUser });
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
    if (!validText(name, 100) || !validText(location, 120) || !validText(pinAddress, 300)) {
      return res.status(400).json({ error: 'Name, location, and address are required and must be within the allowed length.' });
    }
    const user = await User.findOneAndUpdate(
      { phone: req.user.phone },
      { $set: { name: name.trim(), location: location.trim(), pinAddress: pinAddress.trim() } },
      { new: true, runValidators: true }
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

    const validDate = isValidBookingDate(
      preferredDate,
      new Date(),
      process.env.BUSINESS_TIME_ZONE || 'Asia/Kolkata'
    );
    if (!validText(appliance, 80) || !validText(serviceType, 100) || !validDate
      || !validText(preferredTime, 40) || (description != null && (typeof description !== 'string' || description.length > 1000))) {
      return res.status(400).json({
        error: 'Provide a valid appliance, service type, future date, time, and a description under 1000 characters.',
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
      appliance: appliance.trim(),
      serviceType: serviceType.trim(),
      description: typeof description === 'string' ? description.trim() : '',
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
app.post('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), asyncHandler(async (req, res) => {
  if (!adminCredentialsConfigured) {
    return res.status(503).json({ error: 'Admin sign-in is not configured on this server.' });
  }
  const { username, password } = req.body;
  if (!validText(username, 100) || typeof password !== 'string' || password.length < 1 || password.length > 200)
    return res.status(400).json({ error: 'Username and password required' });

  const passwordMatches = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (username !== ADMIN_USERNAME || !passwordMatches)
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { username: ADMIN_USERNAME, role: 'admin', name: ADMIN_NAME },
    JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS256' }
  );
  res.json({ success: true, token, admin: { username: ADMIN_USERNAME, name: ADMIN_NAME } });
}));

// GET /api/admin/bookings
app.get(
  '/api/admin/bookings',
  adminMiddleware,
  asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    if ((status != null && (typeof status !== 'string' || !['pending', 'confirmed', 'rejected', 'completed'].includes(status)))
      || !Number.isInteger(pageNumber) || pageNumber < 1
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: 'Invalid status, page, or limit. Limit must be between 1 and 100.' });
    }
    const filter = status ? { status } : {};
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);
    const total = await Booking.countDocuments(filter);
    res.json({ bookings, total, page: pageNumber, limit: pageSize });
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
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
  if (!isProduction) {
    console.error(err.stack);
  }
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  res.status(500).json({
    error: 'Internal server error',
    ...(!isProduction && { detail: err.message }),
  });
});

// ─── START SERVER ─────────────────────────────────────────────────────────
// Do not accept traffic until MongoDB is ready to serve application requests.
mongoose.connect(MONGO_URI)
  .then(() => new Promise((resolve) => {
    console.log('✅ Connected to MongoDB!');
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log('🔐 Admin login: username=admin');
      console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
      resolve(server);
    });
    server.on('error', (error) => {
      console.error('❌ Server failed to start:', error.message);
      process.exit(1);
    });
  }))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });