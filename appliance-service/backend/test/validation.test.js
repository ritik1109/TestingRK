const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidBookingDate,
  isValidBookingTime,
  isValidPinCode,
  getAuthIntentError,
  normalizePhone,
  validText,
} = require('../lib/validation');

test('normalizes supported ten-digit and +91 phone numbers', () => {
  assert.equal(normalizePhone('9876543210'), '9876543210');
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
});

test('rejects unsupported phone lengths and country prefixes', () => {
  assert.equal(normalizePhone('12345678901'), '');
  assert.equal(normalizePhone('+1 9876543210'), '');
  assert.equal(normalizePhone(''), '');
});

test('validates trimmed text and maximum length', () => {
  assert.equal(validText('  AC repair ', 20), true);
  assert.equal(validText('   ', 20), false);
  assert.equal(validText('overlong', 3), false);
  assert.equal(validText(42, 20), false);
});

test('accepts valid Indian postal PIN codes and rejects invalid values', () => {
  assert.equal(isValidPinCode('452001'), true);
  assert.equal(isValidPinCode('012345'), false);
  assert.equal(isValidPinCode('12345'), false);
  assert.equal(isValidPinCode('12345a'), false);
});

test('requires existing phone accounts to sign in and new numbers to sign up', () => {
  assert.equal(getAuthIntentError('signup', true), 'An account already exists for this phone number. Please sign in instead.');
  assert.equal(getAuthIntentError('signin', false), 'No account was found for this phone number. Please sign up instead.');
  assert.equal(getAuthIntentError('signup', false), null);
  assert.equal(getAuthIntentError('signin', true), null);
  assert.equal(getAuthIntentError(undefined, false), null);
});

test('accepts valid current/future dates and rejects invalid or past dates', () => {
  const today = new Date('2026-10-24T10:00:00.000Z');
  assert.equal(isValidBookingDate('2026-10-25', today, 'Asia/Kolkata'), true);
  assert.equal(isValidBookingDate('2026-10-24', today, 'Asia/Kolkata'), true);
  assert.equal(isValidBookingDate('2026-10-23', today, 'Asia/Kolkata'), false);
  assert.equal(isValidBookingDate('2026-02-30', today, 'Asia/Kolkata'), false);
  assert.equal(isValidBookingDate('25-10-2026', today, 'Asia/Kolkata'), false);
});

test('uses local business date near the UTC day boundary', () => {
  const earlyMorningInIndia = new Date('2026-10-24T20:00:00.000Z');
  assert.equal(isValidBookingDate('2026-10-25', earlyMorningInIndia, 'Asia/Kolkata'), true);
  assert.equal(isValidBookingDate('2026-10-24', earlyMorningInIndia, 'Asia/Kolkata'), false);
});

test('accepts configured appointment slots on future dates only', () => {
  const now = new Date('2026-10-24T10:00:00.000Z');
  assert.equal(isValidBookingTime('10AM-12PM', '2026-10-26', now, 'Asia/Kolkata'), true);
  assert.equal(isValidBookingTime('9AM-11AM', '2026-10-26', now, 'Asia/Kolkata'), false);
});

test('same-day booking slots must not have started in the business timezone', () => {
  const beforeFirstSlot = new Date('2026-10-25T04:29:00.000Z');
  const atFirstSlotStart = new Date('2026-10-25T04:30:00.000Z');
  const afterLastSlotStart = new Date('2026-10-25T13:01:00.000Z');
  assert.equal(isValidBookingTime('10AM-12PM', '2026-10-25', beforeFirstSlot, 'Asia/Kolkata'), true);
  assert.equal(isValidBookingTime('10AM-12PM', '2026-10-25', atFirstSlotStart, 'Asia/Kolkata'), false);
  assert.equal(isValidBookingTime('6PM-7PM', '2026-10-25', afterLastSlotStart, 'Asia/Kolkata'), false);
  assert.equal(isValidBookingTime('invalid', '2026-10-25', beforeFirstSlot, 'Asia/Kolkata'), false);
});
