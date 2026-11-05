import { addDays, addMonths, weekStart, monthStart, weekday, DAY_SHORT, monthShort, fromISO, diffDays } from './dates.js';

export function fmtDur(min) {
  min = min || 0; // a log without minutes ("done" only) counts as 0
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} dk`;
  if (!m) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function minutesByDay(logs, activityId = null) {
  const map = {};
  for (const l of logs) {
    if (activityId && l.activityId !== activityId) continue;
    map[l.date] = (map[l.date] || 0) + l.minutes;
  }
  return map;
}

// A day counts as "done" when the activity has any log that day, with or without minutes.
export function doneDays(logs, activityId = null) {
  const set = new Set();
  for (const l of logs) if (!activityId || l.activityId === activityId) set.add(l.date);
  return set;
}

function runFrom(set, todayISO) {
  let d = set.has(todayISO) ? todayISO : addDays(todayISO, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
// Consecutive done days. If today has none yet, count back from yesterday.
export const streak = (logs, activityId, todayISO) => runFrom(doneDays(logs, activityId), todayISO);

export function activeDays(logs, activityId, from, to) {
  let n = 0;
  for (const d of doneDays(logs, activityId)) if (d >= from && d <= to) n++;
  return n;
}

// "Habits" = what is tracked as done / not done: every activity plus every repeating task (daily or chosen weekdays).
// { id, kind: 'aktivite' | 'görev', name, color (palette index or null for tasks), weekly (target days per week), done: Set of ISO dates }
export function habitList(data) {
  const acts = (data.activities || []).map((a) => ({ id: a.id, kind: 'aktivite', name: a.name, color: a.color ?? 0, weekly: a.weeklyDays || 1, done: doneDays(data.logs, a.id), dailyMinutes: a.dailyMinutes || null }));
  const tasks = (data.tasks || []).filter((t) => t.repeat === 'daily' || t.repeat === 'days').map((t) => ({
    id: t.id, kind: 'görev', name: t.title, color: null, weekly: t.repeat === 'daily' ? 7 : Math.max(1, (t.days || []).length), done: new Set(t.doneDates || []), dailyMinutes: null,
  }));
  return [...acts, ...tasks];
}
export const habitStreak = (habits, id, todayISO) => runFrom(id ? (habits.find((h) => h.id === id)?.done || new Set()) : new Set(habits.flatMap((h) => [...h.done])), todayISO);
export function countIn(h, from, to) {
  let n = 0;
  for (const d of h.done) if (d >= from && d <= to) n++;
  return n;
}

export const MODES = { day: 'Günlük', week: 'Haftalık', month: 'Aylık' };
const SIZE = { day: 7, week: 8, month: 6 };

// Period slices shared by every chart. offset 0 = latest window, -1 = one window earlier, ...
// day: the 7 days of a week; week: 8 weeks; month: 6 months.
export function makeBuckets(mode, offset, today) {
  const n = SIZE[mode];
  const buckets = [];
  for (let i = 0; i < n; i++) {
    let start, end, label;
    if (mode === 'day') {
      start = addDays(weekStart(today), offset * 7 + i); end = start;
      label = DAY_SHORT[weekday(start)];
    } else if (mode === 'week') {
      start = addDays(weekStart(today), (offset * n - (n - 1) + i) * 7); end = addDays(start, 6);
      label = `${fromISO(start).getDate()} ${monthShort(start)}`;
    } else {
      start = addMonths(monthStart(today), offset * n - (n - 1) + i); end = addDays(addMonths(start, 1), -1);
      label = monthShort(start);
    }
    buckets.push({ start, end, label });
  }
  return buckets;
}

// Days a habit was done in a slice, and how many it should have been (weekly target scaled to the slice length).
export function habitBucket(h, b) {
  const len = diffDays(b.end, b.start) + 1;
  return { count: countIn(h, b.start, b.end), target: len === 1 ? null : Math.max(1, Math.round((h.weekly * len) / 7)), len };
}

// offset 0 = latest window, -1 = one window earlier, ...
export function buildSeries(logs, { activityId = null, mode, offset = 0, today }) {
  const n = SIZE[mode];
  const buckets = makeBuckets(mode, offset, today).map((b) => ({ ...b, total: 0, parts: {} }));
  const first = buckets[0].start, last = buckets[n - 1].end;
  for (const l of logs) {
    if (activityId && l.activityId !== activityId) continue;
    if (l.date < first || l.date > last) continue;
    const b = buckets.find((x) => l.date >= x.start && l.date <= x.end);
    b.total += l.minutes || 0;
    b.parts[l.activityId] = (b.parts[l.activityId] || 0) + (l.minutes || 0);
  }
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const days = diffDays(last, first) + 1;
  return { buckets, total, first, last, days };
}

// Tasks (SPEC §3): repeat = none | daily | days; `days` uses Monday = 0.
export function taskDone(t, iso) {
  return t.repeat === 'daily' || t.repeat === 'days' ? (t.doneDates || []).includes(iso) : !!t.done;
}
export function tasksForDay(tasks, iso) {
  return tasks.filter((t) => {
    if (t.repeat === 'daily') return t.date <= iso;
    if (t.repeat === 'days') return t.date <= iso && (t.days || []).includes(weekday(iso));
    return t.date === iso || (t.date < iso && !t.done);
  });
}

// Long-term goal progress, in the goal's unit. A linked goal counts DAYS DONE (an activity's logs or a repeating task's ticks) since it started;
// hours need logged minutes, so they only make sense for an activity where minutes are entered.
export function goalProgress(goal, logs, tasks = []) {
  if (goal.linkedActivityId && (goal.unit === 'saat' || goal.unit === 'gün')) {
    const since = goal.startDate || '0000-00-00';
    const task = tasks.find((t) => t.id === goal.linkedActivityId);
    if (task) return goal.unit === 'gün' ? new Set((task.doneDates || []).filter((d) => d >= since)).size : 0;
    const mine = logs.filter((l) => l.activityId === goal.linkedActivityId && l.date >= since);
    if (goal.unit === 'saat') return Math.round((mine.reduce((s, l) => s + (l.minutes || 0), 0) / 60) * 10) / 10;
    return new Set(mine.map((l) => l.date)).size;
  }
  return goal.progress || 0;
}
