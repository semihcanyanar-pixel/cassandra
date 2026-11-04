import { describe, it, expect } from 'vitest';
import { occursOn, occurrences, monthGrid, tagScopes } from '../src/lib/events.js';

const ev = (date, repeat = 'none', extra = {}) => ({ id: 'e', title: 't', date, repeat, ...extra });

describe('occursOn', () => {
  it('single event only on its day', () => {
    expect(occursOn(ev('2026-11-06'), '2026-11-06')).toBe(true);
    expect(occursOn(ev('2026-11-06'), '2026-11-07')).toBe(false);
  });
  it('never before the start date', () => {
    expect(occursOn(ev('2026-11-06', 'weekly'), '2026-10-30')).toBe(false);
    expect(occursOn(ev('2026-11-06', 'yearly'), '2025-11-06')).toBe(false);
  });
  it('weekly', () => {
    expect(occursOn(ev('2026-11-06', 'weekly'), '2026-11-13')).toBe(true);
    expect(occursOn(ev('2026-11-06', 'weekly'), '2026-11-14')).toBe(false);
  });
  it('monthly clamps to the last day of short months', () => {
    const e = ev('2026-01-31', 'monthly');
    expect(occursOn(e, '2026-02-28')).toBe(true);
    expect(occursOn(e, '2026-02-27')).toBe(false);
    expect(occursOn(e, '2026-03-31')).toBe(true);
    expect(occursOn(e, '2026-04-30')).toBe(true);
  });
  it('yearly (birthdays), including Feb 29', () => {
    expect(occursOn(ev('2020-11-14', 'yearly'), '2027-11-14')).toBe(true);
    expect(occursOn(ev('2020-11-14', 'yearly'), '2027-11-15')).toBe(false);
    const leap = ev('2024-02-29', 'yearly');
    expect(occursOn(leap, '2027-02-28')).toBe(true);
    expect(occursOn(leap, '2028-02-29')).toBe(true);
    expect(occursOn(leap, '2028-02-28')).toBe(false);
  });
});

describe('occurrences', () => {
  it('sorted by date then time, carries the occurrence date', () => {
    const list = occurrences([ev('2026-11-06', 'none', { time: '10:30' }), ev('2026-11-01', 'weekly', { time: '08:00' })], '2026-11-01', '2026-11-14');
    expect(list.map((o) => o.date)).toEqual(['2026-11-01', '2026-11-06', '2026-11-08', '2026-11-15'].slice(0, 3));
    expect(list[2].baseDate).toBe('2026-11-01');
  });
});

describe('monthGrid', () => {
  it('starts on a Monday and has 42 cells', () => {
    const g = monthGrid('2026-11-01'); // Sunday
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-10-26');
    expect(g).toContain('2026-11-30');
  });
});

describe('tagScopes', () => {
  it('marks personal vs family', () => {
    const t = tagScopes([ev('2026-11-06')], [ev('2026-11-07')]);
    expect(t.map((e) => e.scope)).toEqual(['aile', 'kisisel']);
  });
});
