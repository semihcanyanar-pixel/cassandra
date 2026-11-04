import { describe, it, expect } from 'vitest';
import { weekStart, addDays } from '../src/lib/dates.js';
import { fmtDur, streak, buildSeries, tasksForDay, taskDone, goalProgress, minutesByDay } from '../src/lib/stats.js';

const L = (date, minutes, activityId = 'a') => ({ date, minutes, activityId });

describe('dates', () => {
  it('week starts on Monday', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // Wednesday
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday
  });
  it('addDays crosses month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });
});

describe('fmtDur', () => {
  it('formats', () => {
    expect(fmtDur(135)).toBe('2 sa 15 dk');
    expect(fmtDur(60)).toBe('1 sa');
    expect(fmtDur(45)).toBe('45 dk');
    expect(fmtDur(0)).toBe('0 dk');
  });
});

describe('streak', () => {
  const logs = [L('2026-11-04', 10), L('2026-11-03', 5, 'b'), L('2026-11-02', 20), L('2026-10-30', 5)];
  it('counts consecutive days across activities', () => expect(streak(logs, null, '2026-11-04')).toBe(3));
  it('per activity', () => expect(streak(logs, 'a', '2026-11-04')).toBe(1));
  it('empty today falls back to yesterday', () => expect(streak(logs, null, '2026-11-05')).toBe(3));
  it('broken by a gap', () => expect(streak(logs, null, '2026-11-07')).toBe(0));
  it('same day twice counts once', () => expect(streak([L('2026-11-04', 5), L('2026-11-04', 5)], null, '2026-11-04')).toBe(1));
});

describe('buildSeries', () => {
  const logs = [L('2026-11-02', 30), L('2026-11-02', 15, 'b'), L('2026-11-04', 60), L('2026-10-20', 40)];
  it('day mode = Mon..Sun of current week', () => {
    const s = buildSeries(logs, { mode: 'day', offset: 0, today: '2026-11-04' });
    expect(s.buckets[0].start).toBe('2026-11-02');
    expect(s.buckets[0].total).toBe(45);
    expect(s.buckets[2].total).toBe(60);
    expect(s.total).toBe(105);
  });
  it('filters by activity', () => {
    const s = buildSeries(logs, { activityId: 'a', mode: 'day', offset: 0, today: '2026-11-04' });
    expect(s.total).toBe(90);
  });
  it('week mode ends at current week and pages back', () => {
    const s = buildSeries(logs, { mode: 'week', offset: 0, today: '2026-11-04' });
    expect(s.buckets).toHaveLength(8);
    expect(s.buckets[7].start).toBe('2026-11-02');
    expect(s.buckets[5].total).toBe(40); // week of 2026-10-19
    const prev = buildSeries(logs, { mode: 'week', offset: -1, today: '2026-11-04' });
    expect(prev.buckets[7].start).toBe('2026-09-07');
  });
  it('month mode', () => {
    const s = buildSeries(logs, { mode: 'month', offset: 0, today: '2026-11-04' });
    expect(s.buckets).toHaveLength(6);
    expect(s.buckets[5].total).toBe(105);
    expect(s.buckets[4].total).toBe(40);
  });
});

describe('tasks', () => {
  const none = { repeat: 'none', date: '2026-11-04', done: false };
  const daily = { repeat: 'daily', date: '2026-11-01', doneDates: ['2026-11-04'] };
  const days = { repeat: 'days', date: '2026-11-01', days: [2], doneDates: [] }; // Wednesday
  it('visibility', () => {
    expect(tasksForDay([none, daily, days], '2026-11-04')).toHaveLength(3);
    expect(tasksForDay([none, daily, days], '2026-11-05')).toEqual([none, daily]); // open task carries over
    expect(tasksForDay([{ ...none, done: true }, daily, days], '2026-11-05')).toEqual([{ ...none, done: true }, daily].slice(1));
    expect(tasksForDay([{ ...none, done: true }], '2026-11-06')).toHaveLength(0);
    expect(tasksForDay([none], '2026-11-06')).toHaveLength(1); // overdue and open
  });
  it('done state', () => {
    expect(taskDone(daily, '2026-11-04')).toBe(true);
    expect(taskDone(daily, '2026-11-05')).toBe(false);
    expect(taskDone({ ...none, done: true }, '2026-11-04')).toBe(true);
  });
});

describe('goalProgress', () => {
  const logs = [L('2026-11-01', 90), L('2026-11-02', 30), L('2026-10-01', 600)];
  it('manual', () => expect(goalProgress({ progress: 3 }, logs)).toBe(3));
  it('linked hours since start', () => expect(goalProgress({ linkedActivityId: 'a', unit: 'saat', startDate: '2026-11-01' }, logs)).toBe(2));
  it('linked days', () => expect(goalProgress({ linkedActivityId: 'a', unit: 'gün', startDate: '2026-11-01' }, logs)).toBe(2));
  it('minutesByDay', () => expect(minutesByDay(logs, 'a')['2026-11-01']).toBe(90));
});
