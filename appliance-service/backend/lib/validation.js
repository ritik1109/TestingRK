/** Normalize supported Indian phone-number formats without silently accepting other countries. */
function normalizePhone(phone) {
  const digits = String(phone || '').trim().replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return '';
}

/** Require trimmed non-empty text while bounding input size before database writes. */
function validText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

/** Reject malformed or past ISO dates in the configured local business timezone. */
function isValidBookingDate(value, now = new Date(), timeZone = 'Asia/Kolkata') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === value
    && value >= today;
}

module.exports = { isValidBookingDate, normalizePhone, validText };
