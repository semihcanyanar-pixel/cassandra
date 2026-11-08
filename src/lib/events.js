import { addDays, diffDays, fromISO, toISO } from './dates.js';

export const REPEATS = [
  { value: 'none', label: 'Yok' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' },
];
export const REMINDS = [
  { value: 'none', label: 'Yok' },
  { value: 'at', label: 'Zamanında', needsTime: true },
  { value: '30m', label: '30 dk önce', needsTime: true },
  { value: '2h', label: '2 saat önce', needsTime: true },
  { value: '1d', label: '1 gün önce' },
  { value: 'custom', label: 'Özel' }, // saved as 'd:N' = N days before
];
export const MAX_REMIND_DAYS = 365;
// Day based reminders: 'd:5' (5 days before), 'd:5@18:30' (5 days before at 18:30), 'd:0@08:00' (same day at 08:00) and the older '1d'.
// -> { n: days before, time: 'HH:MM' | null } (null time = the old behaviour: the event's own time, or 09:00 for all-day events); anything else -> null
export const dayRemind = (v) => {
  const m = /^d:([0-9]{1,3})(?:@([01][0-9]|2[0-3]):([0-5][0-9]))?$/.exec(v || '');
  if (m) { const n = Number(m[1]); return n >= 0 && n <= MAX_REMIND_DAYS ? { n, time: m[2] ? `${m[2]}:${m[3]}` : null } : null; }
  return v === '1d' ? { n: 1, time: null } : null;
};
// 'd:5' -> 5, anything else -> null (only the form without a clock time, n >= 1)
export const customDays = (v) => { const m = /^d:([0-9]{1,3})$/.exec(v || ''); const n = m ? Number(m[1]) : null; return n >= 1 && n <= MAX_REMIND_DAYS ? n : null; };
// All reminders of an event: the new `reminds` list, or the older single `remind` value.
export const remindsOf = (e) => (Array.isArray(e?.reminds) ? e.reminds : e?.remind && e.remind !== 'none' ? [e.remind] : []);
const ORDER = { at: 0, '30m': 1, '2h': 2 };
// Sorted from the closest to the furthest ahead: at, 30m, 2h, then days ascending.
export const sortReminds = (list) => list.slice().sort((a, b) => remindRank(a) - remindRank(b));
const remindRank = (v) => {
  if (v in ORDER) return ORDER[v];
  const d = dayRemind(v);
  if (!d) return 999;
  const [h, m] = (d.time || '09:00').split(':').map(Number);
  return 10 + d.n - (h * 60 + m) / 1440; // further ahead first, on the same day the later clock time is the closer one
};
export const remindsLabel = (list) => list.map((v) => remindLabel(v)).filter(Boolean).join(', ');
export const remindLabel = (v) => {
  const d = dayRemind(v);
  if (d) return `${d.n === 0 ? 'Aynı gün' : `${d.n} gün önce`}${d.time ? ` · ${d.time}` : ''}`;
  return v && v !== 'none' ? REMINDS.find((r) => r.value === v)?.label : null;
};
export const repeatLabel = (v) => (v && v !== 'none' ? REPEATS.find((r) => r.value === v)?.label : null);

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate(); // m: 0-11

// Does `ev` (title/date/repeat) fall on day `iso`? Monthly/yearly clamp to the last day of short months (Feb 29 -> Feb 28).
export function occursOn(ev, iso) {
  if (iso < ev.date) return false;
  const rep = ev.repeat || 'none';
  if (rep === 'none') return iso === ev.date;
  if (rep === 'weekly') return diffDays(iso, ev.date) % 7 === 0;
  const s = fromISO(ev.date), d = fromISO(iso);
  const day = Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
  if (rep === 'monthly') return d.getDate() === day;
  if (rep === 'yearly') return d.getMonth() === s.getMonth() && d.getDate() === day;
  return false;
}

const byTime = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));

// All occurrences in [from, to] (inclusive), each as { ...event, date: occurrenceDate, baseDate }.
export function occurrences(events, from, to) {
  const out = [];
  const days = diffDays(to, from);
  for (let i = 0; i <= days; i++) {
    const iso = addDays(from, i);
    for (const ev of events) if (occursOn(ev, iso)) out.push({ ...ev, date: iso, baseDate: ev.date });
  }
  return out.sort(byTime);
}

// Merge family + personal events, tagging the scope used for display (and for editing).
export function tagScopes(family, personal) {
  return [...family.map((e) => ({ ...e, scope: 'aile' })), ...personal.map((e) => ({ ...e, scope: 'kisisel' }))];
}

export const monthGrid = (monthStartISO) => {
  const d = fromISO(monthStartISO);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const lead = (fromISO(first).getDay() + 6) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};
