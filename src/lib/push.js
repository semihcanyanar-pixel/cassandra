import { occurrences } from './events.js';
import { addDays, fromISO } from './dates.js';
import { dosesForDay, medLine } from './meds.js';
import { tasksForDay, taskDone } from './stats.js';

// Local date + "HH:MM" -> epoch ms (device time zone).
export function localMs(iso, hhmm) {
  const d = fromISO(iso);
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const OFFSETS = { at: 0, '30m': 30, '2h': 120 };
const dayWord = (iso, todayISO) => (iso === todayISO ? 'Bugün' : iso === addDays(todayISO, 1) ? 'Yarın' : null);

// Event reminders for the next `days` days. Timed: at / 30m / 2h / 1d before. All-day: only "1d" (09:00 the day before).
export function eventItems(events, todayISO, days = 14) {
  const out = [];
  for (const e of occurrences(events, todayISO, addDays(todayISO, days + 1))) {
    const r = e.remind || 'none';
    if (r === 'none') continue;
    let t;
    if (e.time) t = r === '1d' ? localMs(e.date, e.time) - 24 * 3600_000 : localMs(e.date, e.time) - OFFSETS[r] * 60_000;
    else if (r === '1d') t = localMs(addDays(e.date, -1), '09:00');
    else continue;
    const when = e.time ? `${dayWord(e.date, todayISO) || e.date} ${e.time}` : (dayWord(e.date, todayISO) || e.date);
    out.push({ id: `e-${e.scope}-${e.id}-${e.date}-${r}`, t, title: e.title, body: r === 'at' ? 'Şimdi' : `Hatırlatma · ${when}` });
  }
  return out;
}

// Medication dose reminders for the next `days` days, only for people in `wantIds` (a Set of person ids) and doses not marked yet.
export function medItems(meds, logs, people, wantIds, todayISO, days = 7) {
  const mine = meds.filter((m) => wantIds.has(m.forId));
  const out = [];
  for (let i = 0; i <= days; i++) {
    const iso = addDays(todayISO, i);
    for (const d of dosesForDay(mine, logs, iso)) {
      if (d.log) continue;
      const person = people.find((p) => p.id === d.med.forId)?.name || '';
      out.push({ id: `m-${d.id}`, t: localMs(iso, d.time), title: `İlaç zamanı · ${d.time}`, body: medLine(d.med, person) });
    }
  }
  return out;
}

// Task reminders (`remindTime` "HH:MM") for the next `days` days: repeating tasks on their days, one-off tasks on their date. Done tasks are skipped.
export function taskItems(tasks, todayISO, days = 7) {
  const out = [];
  for (let i = 0; i <= days; i++) {
    const iso = addDays(todayISO, i);
    for (const t of tasks) {
      if (!t.remindTime) continue;
      const repeating = t.repeat === 'daily' || t.repeat === 'days';
      if (!(repeating ? tasksForDay([t], iso).length > 0 : t.date === iso)) continue;
      if (taskDone(t, iso)) continue;
      out.push({ id: `t-${t.id}-${iso}`, t: localMs(iso, t.remindTime), title: t.title, body: 'Görev hatırlatması' });
    }
  }
  return out;
}

// Only future-ish items, soonest first, capped.
export function buildSchedule(items, nowMs = Date.now(), max = 300) {
  return items.filter((i) => i.t > nowMs - 30 * 60_000).sort((a, b) => a.t - b.t).slice(0, max);
}
