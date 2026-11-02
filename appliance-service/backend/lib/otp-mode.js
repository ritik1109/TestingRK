function isDevelopmentOtpMode({ nodeEnv, deliveryMode, phone, testPhone }) {
  return nodeEnv === 'development'
    && deliveryMode === 'development'
    && typeof testPhone === 'string'
    && testPhone.length === 10
    && phone === testPhone;
}

module.exports = { isDevelopmentOtpMode };
