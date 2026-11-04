// Dates are local "YYYY-MM-DD" strings (device is in Europe/Istanbul; no UTC conversion on purpose).
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => toISO(new Date());
export const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const weekday = (iso) => (fromISO(iso).getDay() + 6) % 7; // Monday = 0
export const weekStart = (iso) => addDays(iso, -weekday(iso));
export const monthStart = (iso) => iso.slice(0, 8) + '01';
export const addMonths = (iso, n) => { const d = fromISO(monthStart(iso)); d.setMonth(d.getMonth() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 86400000);

export const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const DAY_LETTER = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const monthShort = (iso) => MONTHS[fromISO(iso).getMonth()];
export const dayMonth = (iso) => `${fromISO(iso).getDate()} ${monthShort(iso)}`;
