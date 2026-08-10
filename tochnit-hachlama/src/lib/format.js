const ILS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const ILS_PRECISE = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });

export function money(n, precise = false) {
  const v = Number.isFinite(n) ? n : 0;
  return (precise ? ILS_PRECISE : ILS).format(v);
}

export function shortMoney(n) {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('he-IL', { maximumFractionDigits: 1 })} אלף ₪`;
  return money(v);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(dateStr = todayISO()) {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function firstOfMonthISO(dateStr = todayISO()) {
  return `${monthKey(dateStr)}-01`;
}

export function addMonthsISO(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function monthsBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00');
  const b = new Date(toISO + 'T00:00:00');
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function humanMonthYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function humanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function humanDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function dayOfWeekName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return HEBREW_DAYS[d.getDay()];
}

export function dayOfWeekIndex(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDay();
}

export function isSameMonth(dateStr, monthKeyStr) {
  return monthKey(dateStr) === monthKeyStr;
}

export function daysInMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function pct(part, whole) {
  if (!whole) return 0;
  return clamp((part / whole) * 100, 0, 999);
}
