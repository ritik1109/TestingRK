const test = require('node:test');
const assert = require('node:assert/strict');
const { isDevelopmentOtpMode } = require('../lib/otp-mode');

const testPhone = '9876543210';

test('allows development OTP only for the configured test phone', () => {
  assert.equal(isDevelopmentOtpMode({
    nodeEnv: 'development',
    deliveryMode: 'development',
    phone: testPhone,
    testPhone,
  }), true);
});

test('does not expose development OTP for other phone numbers', () => {
  assert.equal(isDevelopmentOtpMode({
    nodeEnv: 'development',
    deliveryMode: 'development',
    phone: '9876543211',
    testPhone,
  }), false);
});

test('never enables response OTP outside explicit development mode', () => {
  for (const nodeEnv of ['production', 'test', undefined]) {
    assert.equal(isDevelopmentOtpMode({
      nodeEnv,
      deliveryMode: 'development',
      phone: testPhone,
      testPhone,
    }), false);
  }
  assert.equal(isDevelopmentOtpMode({
    nodeEnv: 'development',
    deliveryMode: 'fast2sms',
    phone: testPhone,
    testPhone,
  }), false);
});
