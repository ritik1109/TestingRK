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

/** Validate a six-digit Indian postal PIN code. */
function isValidPinCode(value) {
  return typeof value === 'string' && /^[1-9]\d{5}$/.test(value);
}

/** Keep sign-up and sign-in outcomes aligned with whether the verified phone has an account. */
function getAuthIntentError(intent, userExists) {
  if (intent === 'signup' && userExists) {
    return 'An account already exists for this phone number. Please sign in instead.';
  }
  if (intent === 'signin' && !userExists) {
    return 'No account was found for this phone number. Please sign up instead.';
  }
  return null;
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

/** Accept only configured booking windows and prevent selecting a slot already started today. */
function isValidBookingTime(value, date, now = new Date(), timeZone = 'Asia/Kolkata') {
  const slots = [
    { value: '10AM-12PM', startMinute: 10 * 60 },
    { value: '12PM-2PM', startMinute: 12 * 60 },
    { value: '2PM-4PM', startMinute: 14 * 60 },
    { value: '4PM-6PM', startMinute: 16 * 60 },
    { value: '6PM-7PM', startMinute: 18 * 60 },
  ];
  const slot = slots.find((candidate) => candidate.value === value);
  if (!slot || typeof date !== 'string') return false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  if (date !== today) return true;

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(timeParts.find((part) => part.type === 'hour')?.value);
  const minute = Number(timeParts.find((part) => part.type === 'minute')?.value);
  return slot.startMinute > hour * 60 + minute;
}

module.exports = {
  getAuthIntentError,
  isValidBookingDate,
  isValidBookingTime,
  isValidPinCode,
  normalizePhone,
  validText,
};
