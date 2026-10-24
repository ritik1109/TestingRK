const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidBookingDate, normalizePhone, validText } = require('../lib/validation');

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
