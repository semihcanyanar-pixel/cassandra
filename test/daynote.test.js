import { describe, it, expect } from 'vitest';
import { BUILTIN, START_DATE, REFILL_AHEAD, BATCH, dayIndex, poolItems, pickFor, refillNeeded, dailyNote } from '../src/lib/dayNote.js';
import { addDays } from '../src/lib/dates.js';

describe('Günün notu içeriği', () => {
  it('listeler dolu, her alıntının kaynağı ve her öğenin metni var', () => {
    expect(BUILTIN.motivation.length).toBeGreaterThanOrEqual(40);
    expect(BUILTIN.quote.length).toBeGreaterThanOrEqual(40);
    expect(BUILTIN.tip.length).toBeGreaterThanOrEqual(35);
    for (const q of BUILTIN.quote) { expect(q.t.length).toBeGreaterThan(5); expect(q.by.length).toBeGreaterThan(3); }
    for (const x of [...BUILTIN.motivation, ...BUILTIN.tip]) expect(x.t.length).toBeGreaterThan(10);
  });
  it('gün sırası başlangıç tarihinden sayılır; aynı gün herkese aynı not', () => {
    expect(dayIndex(START_DATE)).toBe(0);
    expect(dayIndex(addDays(START_DATE, 5))).toBe(5);
    expect(dayIndex('2020-01-01')).toBe(0);
    expect(dailyNote(addDays(START_DATE, 3), [])).toEqual(dailyNote(addDays(START_DATE, 3), []));
    expect(dailyNote(START_DATE, []).quote).toEqual(BUILTIN.quote[0]);
  });
  it('ardışık günlerin notu farklıdır', () => {
    const seen = new Set(Array.from({ length: 30 }, (_, i) => dailyNote(addDays(START_DATE, i), []).quote.t));
    expect(seen.size).toBe(30);
  });
  it('liste biterken yeni parti istenir, parti gelince içerik uzar', () => {
    const L = BUILTIN.quote.length;
    expect(refillNeeded('quote', 0, [])).toBeNull();
    expect(refillNeeded('quote', L - REFILL_AHEAD, [])).toBe(0);
    const batch = { id: 'quote-0', items: Array.from({ length: BATCH }, (_, i) => ({ t: `yeni ${i}`, by: 'x' })) };
    expect(poolItems('quote', [batch]).length).toBe(L + BATCH);
    expect(pickFor('quote', L + 2, [batch]).t).toBe('yeni 2');
    expect(refillNeeded('quote', L - REFILL_AHEAD, [batch])).toBeNull();
    expect(refillNeeded('quote', L + BATCH - 5, [batch])).toBe(1);
  });
  it('parti yokken bile her gün bir not vardır (eski öğeler karışık sırayla)', () => {
    const L = BUILTIN.tip.length;
    const a = pickFor('tip', L + 1, []), b = pickFor('tip', L + 2, []);
    expect(a.t).toBeTruthy(); expect(b.t).toBeTruthy(); expect(a.t).not.toBe(b.t);
  });
});
