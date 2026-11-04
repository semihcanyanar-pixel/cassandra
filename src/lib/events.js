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
];
export const remindLabel = (v) => (v && v !== 'none' ? REMINDS.find((r) => r.value === v)?.label : null);
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
