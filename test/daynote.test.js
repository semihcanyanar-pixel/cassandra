import { describe, it, expect } from 'vitest';
import { BUILTIN, QUOTES, CYCLE, QCATS, qpool, START_DATE, REFILL_AHEAD, REFILL_QUOTE, BATCH, dayIndex, poolIndex, poolItems, pickFor, refillNeeded, dailyNote } from '../src/lib/dayNote.js';
import { addDays } from '../src/lib/dates.js';

const day = (n) => addDays(START_DATE, n);

describe('Günün notu içeriği', () => {
  it('listeler dolu, her sözün kaynağı ve her öğenin metni var', () => {
    expect(BUILTIN.motivation.length).toBeGreaterThanOrEqual(40);
    expect(BUILTIN.tip.length).toBeGreaterThanOrEqual(35);
    for (const c of QCATS) for (const q of QUOTES[c]) { expect(q.t.length).toBeGreaterThan(5); expect(q.by.length).toBeGreaterThan(3); }
    for (const x of [...BUILTIN.motivation, ...BUILTIN.tip]) expect(x.t.length).toBeGreaterThan(10);
  });
  it('Türk şair/düşünür, Türk atasözü ve çizgi film yok; atasözleri yabancı', () => {
    const all = QCATS.flatMap((c) => QUOTES[c]);
    expect(all.some((q) => /Türk atasözü|Nâzım|Orhan Veli|Yunus Emre|Mevlânâ|Atatürk|Ortaylı|Aslan Kral|Kung Fu Panda|Nemo/.test(q.by))).toBe(false);
    for (const q of QUOTES.atasozu) expect(q.by).toMatch(/atasözü|deyişi/);
  });
  it('psikolog en sık, roman ikinci sırada gelir', () => {
    const n = (c) => CYCLE.filter((x) => x === c).length;
    expect(n('psikolog')).toBeGreaterThan(n('roman'));
    for (const c of QCATS.filter((x) => x !== 'psikolog' && x !== 'roman')) expect(n('roman')).toBeGreaterThan(n(c));
    expect(CYCLE.every((c) => QCATS.includes(c))).toBe(true);
  });
  it('gün sırası başlangıç tarihinden sayılır; aynı gün herkese aynı not', () => {
    expect(dayIndex(START_DATE)).toBe(0);
    expect(dayIndex(day(5))).toBe(5);
    expect(dayIndex('2020-01-01')).toBe(0);
    expect(dailyNote(day(3), [])).toEqual(dailyNote(day(3), []));
    expect(dailyNote(START_DATE, []).quote.cat).toBe(CYCLE[0]);
  });
  it('her gün sırayla bir kategoriden gelir, kategori kendi listesinde ilerler', () => {
    const cats = Array.from({ length: 9 }, (_, i) => dailyNote(day(i), []).quote.cat);
    expect(cats).toEqual(CYCLE);
    const first = QUOTES.psikolog, seen = Array.from({ length: 27 }, (_, i) => dailyNote(day(i), []).quote).filter((q) => q.cat === 'psikolog');
    expect(seen.slice(0, 9).map((q) => q.t)).toEqual(first.slice(0, 9).map((q) => q.t));
  });
  it('30 günde aynı söz tekrarlanmaz', () => {
    const t = Array.from({ length: 30 }, (_, i) => dailyNote(day(i), []).quote.t);
    expect(new Set(t).size).toBe(30);
  });
  it('liste biterken kategori bazında yeni parti istenir, parti gelince içerik uzar', () => {
    const pool = qpool('film'), L = BUILTIN[pool].length;
    expect(refillNeeded(pool, 0, [])).toBeNull();
    // the day on which only REFILL_QUOTE film items are left
    const d = Array.from({ length: 200 }, (_, i) => i).find((i) => L - poolIndex(pool, i) <= REFILL_QUOTE);
    expect(refillNeeded(pool, d, [])).toBe(0);
    const batch = { id: `${pool}-0`, items: Array.from({ length: 30 }, (_, i) => ({ t: `yeni ${i}`, by: 'x' })) };
    expect(poolItems(pool, [batch]).length).toBe(L + 30);
    expect(pickFor(pool, L + 2, [batch]).t).toBe('yeni 2');
    expect(refillNeeded(pool, d, [batch])).toBeNull();
  });
  it('motivasyon ve ipucu günlük sayılır, partiler 60 öğe', () => {
    expect(BATCH).toBe(60);
    expect(refillNeeded('motivation', 0, [])).toBeNull();
    expect(refillNeeded('motivation', BUILTIN.motivation.length - REFILL_AHEAD, [])).toBe(0);
  });
  it('parti yokken bile her gün bir söz vardır (eski öğeler karışık sırayla)', () => {
    const L = BUILTIN.tip.length;
    const a = pickFor('tip', L + 1, []), b = pickFor('tip', L + 2, []);
    expect(a.t).toBeTruthy(); expect(b.t).toBeTruthy(); expect(a.t).not.toBe(b.t);
    expect(dailyNote(day(400), []).quote.t).toBeTruthy();
  });
});
