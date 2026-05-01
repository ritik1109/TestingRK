require('dotenv').config();
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

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// ─── MONGODB CONNECTION ────────────────────────────────────────────────────
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file!');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB permanently!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ─── MONGOOSE MODELS ───────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: { type: String, default: 'User' },
  phone: { type: String, required: true, unique: true },
  location: { type: String, default: '' },
  pinAddress: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
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
  status: { type: String, default: 'pending' }, // pending | confirmed | rejected | completed
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', BookingSchema);

const OtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  otp: String,
  expiresAt: Number
});
const Otp = mongoose.model('Otp', OtpSchema);

// In-memory for admin (doesn't need permanent DB storage for now)
const admins = { 'admin': { password: 'Admin@1234', name: 'Super Admin' } };

// ─── HELPERS ───────────────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendViaFast2SmsOtpRoute(phone, otp) {
  const smsResponse = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    { route: 'q', message: `Your verification OTP is ${otp}`, numbers: phone, flash: 0 },
    { headers: { authorization: FAST2SMS_API_KEY, 'Content-Type': 'application/json' } }
  );
  if (smsResponse?.data?.return !== true) throw new Error('Fast2SMS rejected request');
  return smsResponse.data;
}

async function sendAdminNotificationSms(messageText) {
  if (!ADMIN_PHONE_NUMBER || !FAST2SMS_API_KEY) return;
  try {
    await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      { route: 'q', message: messageText, numbers: ADMIN_PHONE_NUMBER, flash: 0 },
      { headers: { authorization: FAST2SMS_API_KEY, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Admin SMS] Failed:', err.message);
  }
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

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) return res.status(400).json({ error: 'Invalid phone' });
  const normalizedPhone = String(phone).trim();
  const now = Date.now();

  const otp = generateOTP();
  
  // Save OTP to MongoDB
  await Otp.findOneAndUpdate(
    { phone: normalizedPhone },
    { otp, expiresAt: now + 300000 }, // 5 mins
    { upsert: true, new: true }
  );

  try {
    await sendViaFast2SmsOtpRoute(normalizedPhone, otp);
    return res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.log(`[OTP:FALLBACK] +91${normalizedPhone} => ${otp}`);
    return res.json({ success: true, message: 'OTP generated in fallback mode', otp });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp, name, location, pinAddress } = req.body;
  const normalizedPhone = String(phone || '').trim();

  // Check OTP in MongoDB
  const stored = await Otp.findOne({ phone: normalizedPhone });
  if (!stored) return res.status(400).json({ error: 'OTP not sent' });
  if (Date.now() > stored.expiresAt) return res.status(400).json({ error: 'OTP expired' });
  if (stored.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

  await Otp.deleteOne({ phone: normalizedPhone });

  // Create or Update User in MongoDB
  let user = await User.findOne({ phone: normalizedPhone });
  if (!user) {
    user = await User.create({ phone: normalizedPhone, name: name || 'User', location, pinAddress });
  } else {
    if (name) user.name = name;
    if (location) user.location = location;
    if (pinAddress) user.pinAddress = pinAddress;
    await user.save();
  }

  const token = jwt.sign({ id: user._id, phone: normalizedPhone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user });
});

// ─── USER ROUTES ───────────────────────────────────────────────────────────
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  const user = await User.findOne({ phone: req.user.phone });
  if (!user) return res.status(404).json({ error: 'User not found. Please log in again.' });
  res.json({ user });
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  const { name, location, pinAddress } = req.body;
  const user = await User.findOneAndUpdate(
    { phone: req.user.phone },
    { name, location, pinAddress },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

// ─── BOOKING ROUTES ────────────────────────────────────────────────────────
app.post('/api/bookings', authMiddleware, async (req, res) => {
  const { appliance, serviceType, description, preferredDate, preferredTime } = req.body;
  
  const user = await User.findOne({ phone: req.user.phone });
  if (!user) return res.status(401).json({ error: 'User session expired. Log in again.' });

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
    preferredTime
  });

  const adminMessage = `New Booking! ${user.name} booked a service for ${appliance}. Phone: ${user.phone}. Date: ${preferredDate}`;
  sendAdminNotificationSms(adminMessage);

  res.json({ success: true, booking });
});

app.get('/api/bookings/my', authMiddleware, async (req, res) => {
  const myBookings = await Booking.find({ userPhone: req.user.phone }).sort({ createdAt: -1 });
  res.json({ bookings: myBookings });
});

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = admins[username];
  if (!admin || admin.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username, role: 'admin', name: admin.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token, admin: { username, name: admin.name } });
});

app.get('/api/admin/bookings', adminMiddleware, async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  res.json({ bookings });
});

app.put('/api/admin/bookings/:id', adminMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true, booking });
  } catch (err) {
    res.status(400).json({ error: 'Invalid ID' });
  }
});

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
});

app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  const total = await Booking.countDocuments();
  const pending = await Booking.countDocuments({ status: 'pending' });
  const confirmed = await Booking.countDocuments({ status: 'confirmed' });
  const completed = await Booking.countDocuments({ status: 'completed' });
  const rejected = await Booking.countDocuments({ status: 'rejected' });
  const users = await User.countDocuments();
  res.json({ total, pending, confirmed, completed, rejected, users });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin: username=admin, password=Admin@1234`);
});