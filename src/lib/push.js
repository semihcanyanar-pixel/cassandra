import { occurrences, customDays, remindsOf } from './events.js';
import { addDays, fromISO, weekday, DAY_SHORT } from './dates.js';
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
  // events with a long "N days before" reminder must be looked up further ahead, so their reminder still falls inside the window
  const maxN = Math.max(1, ...(events || []).flatMap((e) => remindsOf(e).map((r) => customDays(r) || 0)));
  const horizon = localMs(addDays(todayISO, days + 1), '00:00');
  for (const e of occurrences(events, todayISO, addDays(todayISO, days + 1 + maxN))) {
    for (const r of remindsOf(e)) {
    const n = r === '1d' ? 1 : customDays(r); // days before, when the reminder is day based
    let t;
    if (n) t = e.time ? localMs(e.date, e.time) - n * 24 * 3600_000 : localMs(addDays(e.date, -n), '09:00');
    else if (e.time && OFFSETS[r] != null) t = localMs(e.date, e.time) - OFFSETS[r] * 60_000;
    else continue;
    if (t > horizon) continue;
    const when = e.time ? `${dayWord(e.date, todayISO) || e.date} ${e.time}` : (dayWord(e.date, todayISO) || e.date);
    out.push({ id: `e-${e.scope}-${e.id}-${e.date}-${r}`, t, title: e.title, body: r === 'at' ? 'Şimdi' : `Hatırlatma · ${when}`, go: `event:${e.scope}:${e.id}` });
    }
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
      out.push({ id: `m-${d.id}`, t: localMs(iso, d.time), title: `İlaç zamanı · ${d.time}`, body: medLine(d.med, person), go: 'ilac' });
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
      out.push({ id: `t-${t.id}-${iso}`, t: localMs(iso, t.remindTime), title: t.title, body: 'Görev hatırlatması', go: 'bugun' });
    }
  }
  return out;
}

// Buzdolabı: a reminder at 09:00 on the LAST day an item can be eaten (opened/cooked date + shelfDays). Not a calendar event, push only.
export function fridgeItems(items, todayISO, days = 14) {
  const out = [];
  for (const i of items || []) {
    if (!i.shelfDays || !i.openedOn) continue;
    const last = addDays(i.openedOn, i.shelfDays);
    if (last < todayISO || last > addDays(todayISO, days)) continue;
    out.push({ id: `f-${i.id}-${last}`, t: localMs(last, '09:00'), title: `${i.name} · bugün son gün`, body: i.kind === 'yemek' ? 'Yemeğin son tüketim günü' : 'Son tüketim günü', go: 'fridge' });
  }
  return out;
}

// Shared to-do with a due date: a reminder the day before at 09:00 ("Yarın son gün"). If that moment has already passed
// and the due date is tomorrow, the reminder goes out at 19:00 today instead.
export function todoItems(todos, todayISO, nowMs = Date.now(), days = 14) {
  const out = [];
  for (const t of todos || []) {
    if (t.done || !t.dueDate || t.dueDate < todayISO || t.dueDate > addDays(todayISO, days + 1)) continue;
    const before = addDays(t.dueDate, -1);
    let at = localMs(before, '09:00');
    if (at < nowMs - 30 * 60_000 && t.dueDate === addDays(todayISO, 1)) at = localMs(todayISO, '19:00');
    out.push({ id: `o-${t.id}-${t.dueDate}`, t: at, title: t.text, body: 'Yarın son gün · ortak yapılacak', go: 'todo' });
  }
  return out;
}

// Sunday 20:00 (the next one still ahead): a short look at the coming Monday-Sunday week.
// Counts events, shared to-dos due that week and fridge items whose last day falls in it.
export function weekItems(events, todos, fridge, todayISO, nowMs = Date.now()) {
  let sun = todayISO;
  while (weekday(sun) !== 6) sun = addDays(sun, 1);
  if (localMs(sun, '20:00') < nowMs - 30 * 60_000) sun = addDays(sun, 7);
  const from = addDays(sun, 1), to = addDays(sun, 7);
  const evs = occurrences(events || [], from, to);
  const due = (todos || []).filter((t) => !t.done && t.dueDate && t.dueDate >= from && t.dueDate <= to).length;
  const fr = (fridge || []).filter((i) => i.shelfDays && i.openedOn && addDays(i.openedOn, i.shelfDays) >= from && addDays(i.openedOn, i.shelfDays) <= to).length;
  const parts = [];
  if (evs.length) {
    const e = evs[0];
    parts.push(`${evs.length} etkinlik (ilki: ${DAY_SHORT[weekday(e.date)]}${e.time ? ' ' + e.time : ''} ${e.title})`);
  }
  if (due) parts.push(`${due} yapılacağın son günü var`);
  if (fr) parts.push(`${fr} ürünün son tüketim günü var`);
  return [{ id: `w-${sun}`, t: localMs(sun, '20:00'), title: 'Haftaya bakış', body: parts.length ? parts.join(' · ') : 'Önümüzdeki hafta için kayıtlı bir şey yok.', go: 'takvim' }];
}

// Only future-ish items, soonest first, capped.
export function buildSchedule(items, nowMs = Date.now(), max = 300) {
  return items.filter((i) => i.t > nowMs - 30 * 60_000).sort((a, b) => a.t - b.t).slice(0, max);
}
