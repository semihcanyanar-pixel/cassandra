import { tasksForDay, taskDone, streak } from './stats.js';

// Three automatic day notes (shown on Bugün): morning plan (from 06:00), afternoon check-in, evening wrap-up.
export const SLOTS = [
  { id: 'sabah', from: 6, label: 'Sabah' },
  { id: 'ogle', from: 15, label: 'Öğleden sonra' },
  { id: 'aksam', from: 20, label: 'Akşam' },
];

// The latest slot whose time has come, or null before 06:00.
export const currentSlot = (hour) => [...SLOTS].reverse().find((s) => hour >= s.from) || null;
export const slotDocId = (dateISO, slotId) => `s-${dateISO}-${slotId}`;

// Newest note of today (evening > afternoon > morning) among cached insight docs.
export function latestNote(insights, dateISO) {
  for (const s of [...SLOTS].reverse()) {
    const doc = insights.find((i) => i.id === slotDocId(dateISO, s.id));
    if (doc?.text) return { slot: s, text: doc.text, quote: doc.quote || '' };
  }
  return null;
}

// Today's tasks and activity progress, as sent to the Worker.
export function buildSlotInput(data, dateISO, hour) {
  const tasks = tasksForDay(data.tasks, dateISO).map((t) => ({ title: t.title, done: taskDone(t, dateISO) }));
  const activities = data.activities.map((a) => {
    const logs = data.logs.filter((l) => l.activityId === a.id && l.date === dateISO);
    const min = logs.reduce((s, l) => s + (l.minutes || 0), 0);
    return { name: a.name, todayDone: logs.length > 0, todayMin: min || null, dailyTargetMin: a.dailyMinutes || null };
  });
  return { slot: currentSlot(hour)?.id, hour, tasks, activities, streak: streak(data.logs, null, dateISO) };
}

export const hasPlan = (input) => input.tasks.length > 0 || input.activities.length > 0;

// Weekly evaluation: created automatically on Sunday evening (from 20:00) and shown on Sunday and the following Monday.
export const WEEKLY_FROM = 20;
export const weeklyDue = (weekdayMon0, hour) => weekdayMon0 === 6 && hour >= WEEKLY_FROM;
