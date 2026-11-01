// ── Hospital time (IST) ─────────────────────────────────────────────────────
// The database decides "today" in Asia/Kolkata; the UI mirrors that so a patient
// abroad or a laptop with the wrong timezone still sees the same booking window.
const HOSPITAL_TZ = 'Asia/Kolkata';

/** 'YYYY-MM-DD' for the given instant, in hospital time. */
export function istDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HOSPITAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export const istToday = () => istDateString();

/** 0-23 hour in hospital time. */
export function istHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: HOSPITAL_TZ, hour: '2-digit', hour12: false }).format(date)) % 24;
}

/** Add whole days to a 'YYYY-MM-DD' string (pure calendar maths, no timezone drift). */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Add whole months, clamped to the end of the target month (31 Jan + 1 mo = 28/29 Feb). */
export function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Booking window — mirrors public.book_appointment():
 *  - earliest date: today while it is before 12:00 noon IST, otherwise tomorrow
 *  - latest date: one month from today
 */
export function getBookingWindow() {
  const today = istToday();
  const minStr = istHour() >= 12 ? addDays(today, 1) : today;
  const maxStr = addMonths(today, 1);
  return { minStr, maxStr, today, closedForToday: istHour() >= 12 };
}

/** 'Mon', 'Tue' … for a 'YYYY-MM-DD' string. */
export function weekdayShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Does a doctor's available_days string ('Mon,Tue,…') include this date's weekday? Blank = every day. */
export function isDoctorAvailableOn(doctor, dateStr) {
  const days = (doctor?.available_days || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!days.length || !dateStr) return true;
  return days.includes(weekdayShort(dateStr).toLowerCase());
}

// ── Formatting ──────────────────────────────────────────────────────────────
function toDate(d) {
  if (!d) return null;
  // plain 'YYYY-MM-DD' must be treated as a calendar date, not UTC midnight
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
export function fmtDate(d) {
  const dt = toDate(d);
  return dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
export function fmtTime(d) {
  const dt = toDate(d);
  return dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
}
export function fmtDateTime(d) {
  return d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
}
export function fmtLongDate(d) {
  const dt = toDate(d);
  return dt ? dt.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—';
}

export function avatarUrl(name, size = 128) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=2563eb&color=fff&size=${size}`;
}

export const ROLE_LABELS = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator', medicine_staff: 'Pharmacy Staff' };

export function greeting() {
  const h = istHour();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ── QR payload parsing (shared by Doctor panel + Entry gate) ────────────────
/**
 * Accepts what a MediQueue QR can contain:
 *   1. bare token_uid  → 'OPDGEN23042026DIVMOH003'
 *   2. JSON blob       → {"token_uid": "...", "tokenId": 5, "token": 3}   (older QR format)
 *   3. plain number    → '5'
 * Returns { identifier, displayNum } or null when it isn't a MediQueue code.
 */
export function parseScanPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (text.toUpperCase().startsWith('OPD')) {
    const m = text.match(/(\d+)$/);
    return { identifier: text.toUpperCase(), displayNum: m ? parseInt(m[1], 10) : null };
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const identifier = parsed.token_uid ? String(parsed.token_uid).toUpperCase() : parsed.tokenId ? String(parsed.tokenId) : null;
      if (identifier) return { identifier, displayNum: parsed.token || parsed.tokenNum || null };
    }
  } catch {
    /* not JSON — fall through */
  }
  const n = parseInt(text, 10);
  if (!Number.isNaN(n) && /^\d+$/.test(text)) return { identifier: String(n), displayNum: n };
  return null;
}
