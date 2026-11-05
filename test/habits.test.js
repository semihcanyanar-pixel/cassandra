import { describe, it, expect, vi } from 'vitest';
import { doneDays, streak, activeDays, habitList, habitStreak, habitBucket, makeBuckets, countIn } from '../src/lib/stats.js';
import { buildInsightInput, buildDailyInput } from '../src/screens/InsightCard.jsx';

vi.mock('../src/worker.js', () => ({ callWorker: async () => ({}), workerConfigured: false }));
vi.mock('../src/data.js', () => ({ saveInsight: () => {} }));

const T = '2026-11-05'; // Thursday
const log = (activityId, date, minutes = null) => ({ id: `${activityId}${date}`, activityId, date, minutes });
const data = {
  activities: [{ id: 'a', name: 'Antrenman', color: 1, weeklyDays: 3, dailyMinutes: null }, { id: 'b', name: 'İngilizce', color: 0, weeklyDays: 4, dailyMinutes: 45 }],
  logs: [log('a', '2026-11-05'), log('a', '2026-11-04'), log('a', '2026-11-02'), log('b', '2026-11-05', 30)],
  tasks: [
    { id: 't1', title: 'Vitamin', repeat: 'daily', date: '2026-10-01', doneDates: ['2026-11-05', '2026-11-04'] },
    { id: 't2', title: 'Çanta', repeat: 'days', days: [0, 2, 4], date: '2026-10-01', doneDates: ['2026-11-02'] },
    { id: 't3', title: 'Fatura', repeat: 'none', date: '2026-11-05', done: false },
  ],
};

describe('yapıldı temelli istatistik', () => {
  it('süresiz kayıt da o günü yapıldı sayar; seri ve aktif gün buna göre', () => {
    expect([...doneDays(data.logs, 'a')].sort()).toEqual(['2026-11-02', '2026-11-04', '2026-11-05']);
    expect(streak(data.logs, 'a', T)).toBe(2); // 5 and 4 Nov, the 3rd is missing
    expect(activeDays(data.logs, 'a', '2026-11-02', '2026-11-08')).toBe(3);
  });
  it('alışkanlık listesi aktiviteleri ve tekrarlı görevleri içerir, tek seferlik görevi içermez', () => {
    const h = habitList(data);
    expect(h.map((x) => `${x.kind}:${x.name}:${x.weekly}`)).toEqual(['aktivite:Antrenman:3', 'aktivite:İngilizce:4', 'görev:Vitamin:7', 'görev:Çanta:3']);
    expect(habitStreak(h, null, T)).toBe(2);
    expect(habitStreak(h, 't1', T)).toBe(2);
  });
  it('dönem dilimi: gün için yapıldı, hafta için hedefe oranlanan gün sayısı', () => {
    const h = habitList(data)[0];
    const week = makeBuckets('week', 0, T);
    const b = week[week.length - 1];
    expect(b.start).toBe('2026-11-02');
    expect(habitBucket(h, b)).toEqual({ count: 3, target: 3, len: 7 });
    const days = makeBuckets('day', 0, T);
    expect(days.map((d) => habitBucket(h, d).count)).toEqual([1, 0, 1, 1, 0, 0, 0]);
    expect(habitBucket(h, days[0]).target).toBeNull();
    expect(countIn(h, '2026-11-01', '2026-11-30')).toBe(3);
  });
});

describe('yapay zeka girdisi', () => {
  it('haftalık: gün sayısı ve hedef gün; süre yalnızca girilmişse eklenir', () => {
    const i = buildInsightInput(data, T);
    const ant = i.find((x) => x.name === 'Antrenman');
    expect(ant).toMatchObject({ kind: 'aktivite', weeklyTargetDays: 3, weeks: [0, 0, 0, 3], weekMinutes: null });
    const eng = i.find((x) => x.name === 'İngilizce');
    expect(eng.weekMinutes).toEqual([0, 0, 0, 30]);
    expect(i.find((x) => x.name === 'Vitamin')).toMatchObject({ kind: 'görev', weeklyTargetDays: 7, weeks: [0, 0, 0, 2] });
  });
  it('günlük: bugün yapıldı mı ve son 7 gün', () => {
    const d = buildDailyInput(data, T, 20);
    expect(d.activities[0]).toMatchObject({ name: 'Antrenman', todayDone: true, last7: [0, 0, 0, 1, 0, 1, 1], todayMin: null });
    expect(d.activities[1]).toMatchObject({ todayDone: true, todayMin: 30, dailyTargetMin: 45 });
  });
});

import { goalProgress } from '../src/lib/stats.js';
describe('hedef ilerlemesi', () => {
  it('bağlı aktivite: gün sayısı süresiz kayıtları da sayar, saat yalnızca süreyi', () => {
    const logs = [log('a', '2026-11-02'), log('a', '2026-11-03', 90), log('a', '2026-11-03', 30), log('a', '2026-10-01')];
    expect(goalProgress({ linkedActivityId: 'a', unit: 'gün', startDate: '2026-11-01' }, logs)).toBe(2);
    expect(goalProgress({ linkedActivityId: 'a', unit: 'saat', startDate: '2026-11-01' }, logs)).toBe(2);
  });
  it('bağlı tekrarlı görev: yapıldı günleri başlangıçtan itibaren', () => {
    const tasks = [{ id: 't', repeat: 'daily', doneDates: ['2026-10-30', '2026-11-02', '2026-11-04'] }];
    expect(goalProgress({ linkedActivityId: 't', unit: 'gün', startDate: '2026-11-01' }, [], tasks)).toBe(2);
    expect(goalProgress({ linkedActivityId: 't', unit: 'saat', startDate: '2026-11-01' }, [], tasks)).toBe(0);
  });
  it('elle girilen hedef olduğu gibi kalır', () => {
    expect(goalProgress({ unit: 'adet', progress: 7 }, [])).toBe(7);
  });
});
