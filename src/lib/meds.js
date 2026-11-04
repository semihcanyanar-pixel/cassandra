import { addDays, diffDays } from './dates.js';

export const MEALS = [
  { value: 'fark_etmez', label: 'Fark etmez' },
  { value: 'ac', label: 'Aç' },
  { value: 'tok', label: 'Tok' },
];
export const mealText = (m) => ({ ac: 'aç karnına', tok: 'tok karnına' }[m] || null);

// Suggested dose times per "times per day" (SPEC: 3 -> 08/14/20, 2 -> 09/21, 1 -> 09). Always editable.
const SUGGESTED = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
  6: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'],
};
export const suggestTimes = (n) => (SUGGESTED[n] || SUGGESTED[1]).slice();

export const endFromDays = (start, days) => addDays(start, Math.max(1, days) - 1);
export const daysBetween = (start, end) => diffDays(end, start) + 1;

// People a medication can be for: the two members (profiles) plus dependents (Aslan).
export function medPeople(household, meUid) {
  const members = (household.members || []).map((uid) => {
    const p = household.profiles?.[uid] || {};
    const name = p.name || (uid === meUid ? 'Ben' : 'Eşi');
    return { id: uid, name, initial: p.initial || name.charAt(0).toUpperCase(), kind: 'member' };
  });
  const deps = (household.dependents || []).map((d) => ({ id: d.id, name: d.name, initial: d.initial || d.name.charAt(0), kind: 'dependent' }));
  return [...members, ...deps];
}
// 'me' / 'other' are dev-demo aliases for the signed-in member and the partner.
export function personById(people, id, meUid) {
  const real = id === 'me' ? meUid : id === 'other' ? people.find((p) => p.kind === 'member' && p.id !== meUid)?.id : id;
  return people.find((p) => p.id === real) || { id, name: id === 'other' ? 'Eşi' : 'Bilinmiyor', initial: id === 'other' ? 'E' : '?', kind: 'member' };
}

export const isActiveOn = (med, iso) => !med.archived && med.startDate <= iso && iso <= med.endDate;
// "Over" = ended by date or archived by hand. Periods that have not started yet are neither active nor over.
export const isOver = (med, iso) => Boolean(med.archived) || med.endDate < iso;
export const isUpcoming = (med, iso) => !med.archived && med.startDate > iso;

export const logId = (medId, date, time) => `${medId}_${date}_${time}`;

// All doses due on `iso` for the given medications, sorted by time. `log` is the medLogs doc or null (pending).
export function dosesForDay(meds, logs, iso) {
  const byId = new Map(logs.filter((l) => l.date === iso).map((l) => [l.id, l]));
  const out = [];
  for (const med of meds) {
    if (!isActiveOn(med, iso)) continue;
    for (const time of med.times || []) {
      const id = logId(med.id, iso, time);
      out.push({ id, med, time, date: iso, log: byId.get(id) || null });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name, 'tr'));
}

export const doseState = (d) => (d.log ? d.log.status : 'bekliyor');

// First pending dose that is not yet past (time >= now). Null when nothing is left today.
export function nextDose(doses, nowHHMM) {
  return doses.find((d) => !d.log && d.time >= nowHHMM) || null;
}

export function periodSummary(med, logs) {
  const mine = logs.filter((l) => l.medicationId === med.id);
  const days = daysBetween(med.startDate, med.endDate);
  return {
    taken: mine.filter((l) => l.status === 'alindi').length,
    skipped: mine.filter((l) => l.status === 'atlandi').length,
    total: days * (med.times || []).length,
    days,
  };
}

// "Aslan · D vitamini · 5 damla · tok karnına"
export const medLine = (med, personName) => [personName, med.name, med.dose, mealText(med.meal)].filter(Boolean).join(' · ');

export const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
