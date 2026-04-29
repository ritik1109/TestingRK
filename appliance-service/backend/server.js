require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'appliance_service_secret_2024';
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';
const OTP_FALLBACK_TO_CONSOLE = NODE_ENV !== 'production' && process.env.OTP_FALLBACK_TO_CONSOLE !== 'false';
const OTP_INCLUDE_IN_RESPONSE = process.env.OTP_INCLUDE_IN_RESPONSE === 'true' || NODE_ENV !== 'production';
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS || 5 * 60 * 1000);
const OTP_RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 30 * 1000);
const OTP_RATE_LIMIT_WINDOW_MS = Number(process.env.OTP_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const OTP_RATE_LIMIT_MAX_REQUESTS = Number(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || 5);
const FAST2SMS_DLT_ENABLED = process.env.FAST2SMS_DLT_ENABLED === 'true';
const FAST2SMS_DLT_SENDER_ID = process.env.FAST2SMS_DLT_SENDER_ID || '';
const FAST2SMS_DLT_ENTITY_ID = process.env.FAST2SMS_DLT_ENTITY_ID || '';
const FAST2SMS_DLT_TEMPLATE_ID = process.env.FAST2SMS_DLT_TEMPLATE_ID || '';
const FAST2SMS_DLT_MESSAGE_TEMPLATE = process.env.FAST2SMS_DLT_MESSAGE_TEMPLATE || '';

// app.use(cors());
// app.use(bodyParser.json());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('/{*path}', cors());
app.use(bodyParser.json());



// ─── IN-MEMORY DATABASE ────────────────────────────────────────────────────
const db = {
  users: {},       // phone -> { id, name, phone, location, pinAddress, createdAt }
  otps: {},        // phone -> { otp, expiresAt }
  otpMeta: {},     // phone -> { lastSentAt }
  otpRateLimit: {}, // key(phone+ip) -> { count, windowStart }
  bookings: [],    // []
  admins: {
    'admin': { password: 'Admin@1234', name: 'Super Admin' }
  }
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isFast2SmsAccepted(providerData) {
  return providerData?.return === true && !providerData?.status_code;
}

function buildFast2SmsError(providerData, fallbackMessage) {
  const err = new Error(fallbackMessage);
  err.providerData = providerData;
  return err;
}

async function sendViaFast2SmsOtpRoute(phone, otp) {
  const smsResponse = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    {
      route: 'otp',
      variables_values: otp,
      numbers: phone,
      flash: 0
    },
    {
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  const providerData = smsResponse?.data || {};
  if (!isFast2SmsAccepted(providerData)) {
    throw buildFast2SmsError(providerData, 'Fast2SMS OTP route rejected request');
  }

  return providerData;
}

async function sendViaFast2SmsDltRoute(phone, otp) {
  if (!FAST2SMS_DLT_ENABLED) {
    throw new Error('DLT fallback is disabled');
  }

  if (!FAST2SMS_DLT_SENDER_ID || !FAST2SMS_DLT_ENTITY_ID || !FAST2SMS_DLT_TEMPLATE_ID || !FAST2SMS_DLT_MESSAGE_TEMPLATE) {
    throw new Error('DLT fallback is not configured. Set sender/entity/template/message env values.');
  }

  const message = FAST2SMS_DLT_MESSAGE_TEMPLATE.replace('{otp}', otp);

  const smsResponse = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    {
      route: 'dlt',
      sender_id: FAST2SMS_DLT_SENDER_ID,
      message,
      numbers: phone,
      flash: 0,
      language: 'english',
      entity_id: FAST2SMS_DLT_ENTITY_ID,
      template_id: FAST2SMS_DLT_TEMPLATE_ID
    },
    {
      headers: {
        authorization: FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  const providerData = smsResponse?.data || {};
  if (!isFast2SmsAccepted(providerData)) {
    throw buildFast2SmsError(providerData, 'Fast2SMS DLT route rejected request');
  }

  return providerData;
}

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

  const normalizedPhone = String(phone).trim();
  const now = Date.now();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  const rateKey = `${normalizedPhone}|${ip}`;
  const currentRate = db.otpRateLimit[rateKey];
  if (!currentRate || now - currentRate.windowStart >= OTP_RATE_LIMIT_WINDOW_MS) {
    db.otpRateLimit[rateKey] = { count: 1, windowStart: now };
  } else {
    currentRate.count += 1;
    if (currentRate.count > OTP_RATE_LIMIT_MAX_REQUESTS) {
      const retryInSec = Math.ceil((OTP_RATE_LIMIT_WINDOW_MS - (now - currentRate.windowStart)) / 1000);
      return res.status(429).json({ error: `Too many OTP requests. Try again in ${retryInSec}s.` });
    }
  }

  const otpMeta = db.otpMeta[normalizedPhone];
  if (otpMeta && now - otpMeta.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    const retryInSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - otpMeta.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${retryInSec}s before requesting a new OTP.` });
  }

  const otp = generateOTP();
  db.otps[normalizedPhone] = { otp, expiresAt: now + OTP_EXPIRY_MS };
  db.otpMeta[normalizedPhone] = { lastSentAt: now };

  const successPayload = {
    success: true,
    message: 'OTP sent successfully'
  };

  if (OTP_INCLUDE_IN_RESPONSE) {
    successPayload.otp = otp;
  }

  try {
    if (!FAST2SMS_API_KEY) {
      throw new Error('FAST2SMS_API_KEY is not configured');
    }

    const otpRouteData = await sendViaFast2SmsOtpRoute(normalizedPhone, otp);
    console.log('Fast2SMS OTP route accepted:', {
      phone: `+91${normalizedPhone}`,
      requestId: otpRouteData?.request_id || null,
      returnStatus: otpRouteData?.return || null
    });
    return res.json(successPayload);
  } catch (err) {
    const providerErrorData = err?.response?.data || err?.providerData;
    const providerError = providerErrorData || err.message;
    const providerStatusCode = providerErrorData?.status_code;

    if (providerStatusCode === 996) {
      console.warn('Fast2SMS OTP route blocked with 996, attempting DLT fallback...');
      try {
        const dltRouteData = await sendViaFast2SmsDltRoute(normalizedPhone, otp);
        console.log('Fast2SMS DLT route accepted:', {
          phone: `+91${normalizedPhone}`,
          requestId: dltRouteData?.request_id || null,
          returnStatus: dltRouteData?.return || null
        });
        return res.json({
          ...successPayload,
          message: 'OTP sent successfully via DLT route'
        });
      } catch (dltErr) {
        const dltProviderErrorData = dltErr?.response?.data || dltErr?.providerData;
        const dltProviderError = dltProviderErrorData || dltErr.message;
        console.error('Fast2SMS DLT fallback failed:', dltProviderError);
      }
    }

    console.error('Fast2SMS error:', providerError);

    if (OTP_FALLBACK_TO_CONSOLE) {
      console.warn(`OTP fallback mode active for +91${normalizedPhone}`);
      console.log(`[OTP:FALLBACK] +91${normalizedPhone} => ${otp}`);
      return res.json({
        ...successPayload,
        message: 'OTP generated in fallback mode'
      });
    }

    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp, name, location, pinAddress } = req.body;
  const normalizedPhone = String(phone || '').trim();

  const stored = db.otps[normalizedPhone];
  if (!stored) return res.status(400).json({ error: 'OTP not sent' });
  if (Date.now() > stored.expiresAt) return res.status(400).json({ error: 'OTP expired' });
  if (stored.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  delete db.otps[normalizedPhone];

  // Create or update user
  if (!db.users[normalizedPhone]) {
    db.users[normalizedPhone] = {
      id: uuidv4(),
      name: name || 'User',
      phone: normalizedPhone,
      location: location || '',
      pinAddress: pinAddress || '',
      createdAt: new Date().toISOString()
    };
  } else {
    if (name) db.users[normalizedPhone].name = name;
    if (location) db.users[normalizedPhone].location = location;
    if (pinAddress) db.users[normalizedPhone].pinAddress = pinAddress;
  }

  const user = db.users[normalizedPhone];
  const token = jwt.sign({ id: user.id, phone: normalizedPhone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });

  res.json({ success: true, token, user });
});

// ─── USER ROUTES ───────────────────────────────────────────────────────────

// Get profile
app.get('/api/user/profile', authMiddleware, (req, res) => {
  const user = db.users[req.user.phone];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// Update profile
app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { name, location, pinAddress } = req.body;
  const user = db.users[req.user.phone];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name) user.name = name;
  if (location) user.location = location;
  if (pinAddress) user.pinAddress = pinAddress;
  res.json({ success: true, user });
});

// ─── BOOKING ROUTES ────────────────────────────────────────────────────────

// Create booking
app.post('/api/bookings', authMiddleware, (req, res) => {
  const { appliance, serviceType, description, preferredDate, preferredTime } = req.body;
  const user = db.users[req.user.phone];

  const booking = {
    id: uuidv4(),
    userId: user.id,
    userName: user.name,
    userPhone: user.phone,
    userLocation: user.location,
    userPinAddress: user.pinAddress,
    appliance,
    serviceType,
    description: description || '',
    preferredDate,
    preferredTime,
    status: 'pending', // pending | confirmed | rejected | completed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.bookings.push(booking);
  res.json({ success: true, booking });
});

// Get user bookings
app.get('/api/bookings/my', authMiddleware, (req, res) => {
  const user = db.users[req.user.phone];
  const myBookings = db.bookings
    .filter(b => b.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ bookings: myBookings });
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────────

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.admins[username];
  if (!admin || admin.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, role: 'admin', name: admin.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token, admin: { username, name: admin.name } });
});

// Get all bookings
app.get('/api/admin/bookings', adminMiddleware, (req, res) => {
  const sorted = [...db.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ bookings: sorted });
});

// Update booking status
app.put('/api/admin/bookings/:id', adminMiddleware, (req, res) => {
  const { status } = req.body;
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  res.json({ success: true, booking });
});

// Get all users
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = Object.values(db.users);
  res.json({ users });
});

// Stats
app.get('/api/admin/stats', adminMiddleware, (req, res) => {
  const total = db.bookings.length;
  const pending = db.bookings.filter(b => b.status === 'pending').length;
  const confirmed = db.bookings.filter(b => b.status === 'confirmed').length;
  const completed = db.bookings.filter(b => b.status === 'completed').length;
  const rejected = db.bookings.filter(b => b.status === 'rejected').length;
  const users = Object.keys(db.users).length;
  res.json({ total, pending, confirmed, completed, rejected, users });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin: username=admin, password=Admin@1234`);
});
