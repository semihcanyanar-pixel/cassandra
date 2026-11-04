import { addDays, addMonths, weekStart, monthStart, weekday, DAY_SHORT, monthShort, fromISO, diffDays } from './dates.js';

export function fmtDur(min) {
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

// Consecutive days with at least one log. If today has none yet, count back from yesterday.
export function streak(logs, activityId, todayISO) {
  const m = minutesByDay(logs, activityId);
  let d = m[todayISO] > 0 ? todayISO : addDays(todayISO, -1);
  let n = 0;
  while (m[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}

export function activeDays(logs, activityId, from, to) {
  const m = minutesByDay(logs, activityId);
  let n = 0;
  for (const d in m) if (m[d] > 0 && d >= from && d <= to) n++;
  return n;
}

export const MODES = { day: 'Günlük', week: 'Haftalık', month: 'Aylık' };
const SIZE = { day: 7, week: 8, month: 6 };

// offset 0 = latest window, -1 = one window earlier, ...
export function buildSeries(logs, { activityId = null, mode, offset = 0, today }) {
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
    buckets.push({ start, end, label, total: 0, parts: {} });
  }
  const first = buckets[0].start, last = buckets[n - 1].end;
  for (const l of logs) {
    if (activityId && l.activityId !== activityId) continue;
    if (l.date < first || l.date > last) continue;
    const b = buckets.find((x) => l.date >= x.start && l.date <= x.end);
    b.total += l.minutes;
    b.parts[l.activityId] = (b.parts[l.activityId] || 0) + l.minutes;
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

// Long-term goal progress, in the goal's unit.
export function goalProgress(goal, logs) {
  if (goal.linkedActivityId && (goal.unit === 'saat' || goal.unit === 'gün')) {
    const since = goal.startDate || '0000-00-00';
    const mine = logs.filter((l) => l.activityId === goal.linkedActivityId && l.date >= since);
    if (goal.unit === 'saat') return Math.round((mine.reduce((s, l) => s + l.minutes, 0) / 60) * 10) / 10;
    return new Set(mine.map((l) => l.date)).size;
  }
  return goal.progress || 0;
}
