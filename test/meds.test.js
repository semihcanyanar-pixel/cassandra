import { describe, it, expect } from 'vitest';
import { suggestTimes, endFromDays, daysBetween, isActiveOn, isOver, isUpcoming, dosesForDay, nextDose, periodSummary, medLine, medPeople, logId } from '../src/lib/meds.js';

const med = (o = {}) => ({ id: 'm1', name: 'D vitamini', dose: '5 damla', meal: 'tok', times: ['08:00', '14:00', '20:00'], startDate: '2026-11-03', endDate: '2026-11-09', archived: false, ...o });

describe('ilaç saatleri ve süre', () => {
  it('önerilen saatler', () => {
    expect(suggestTimes(3)).toEqual(['08:00', '14:00', '20:00']);
    expect(suggestTimes(2)).toEqual(['09:00', '21:00']);
    expect(suggestTimes(1)).toEqual(['09:00']);
    expect(suggestTimes(6)).toHaveLength(6);
  });
  it('gün sayısından bitiş tarihi (başlangıç dahil)', () => {
    expect(endFromDays('2026-11-03', 7)).toBe('2026-11-09');
    expect(endFromDays('2026-11-03', 1)).toBe('2026-11-03');
    expect(daysBetween('2026-11-03', '2026-11-09')).toBe(7);
  });
});

describe('dönem durumu', () => {
  it('aktif / biten / başlamamış', () => {
    expect(isActiveOn(med(), '2026-11-05')).toBe(true);
    expect(isActiveOn(med(), '2026-11-09')).toBe(true);
    expect(isActiveOn(med(), '2026-11-10')).toBe(false);
    expect(isOver(med(), '2026-11-10')).toBe(true);
    expect(isOver(med(), '2026-11-09')).toBe(false);
    expect(isUpcoming(med(), '2026-11-01')).toBe(true);
    expect(isActiveOn(med({ archived: true }), '2026-11-05')).toBe(false);
    expect(isOver(med({ archived: true }), '2026-11-05')).toBe(true);
  });
});

describe('günün dozları', () => {
  it('3 dozlu dönem bugün 3 doz gösterir, saat sırasıyla', () => {
    const d = dosesForDay([med()], [], '2026-11-05');
    expect(d.map((x) => x.time)).toEqual(['08:00', '14:00', '20:00']);
    expect(d.every((x) => x.log === null)).toBe(true);
  });
  it('dönem dışındaki gün doz yok', () => {
    expect(dosesForDay([med()], [], '2026-11-12')).toEqual([]);
  });
  it('işaretlenen doz kim/saat bilgisiyle eşleşir', () => {
    const l = { id: logId('m1', '2026-11-05', '14:00'), medicationId: 'm1', date: '2026-11-05', time: '14:00', status: 'alindi', doneBy: 'B' };
    const d = dosesForDay([med()], [l], '2026-11-05');
    expect(d[1].log.doneBy).toBe('B');
    expect(d[0].log).toBeNull();
  });
  it('başka günün kaydı bugünü etkilemez', () => {
    const l = { id: logId('m1', '2026-11-04', '08:00'), date: '2026-11-04', status: 'alindi' };
    expect(dosesForDay([med()], [l], '2026-11-05')[0].log).toBeNull();
  });
  it('sıradaki doz: şimdiden sonraki ilk bekleyen', () => {
    const d = dosesForDay([med()], [{ id: logId('m1', '2026-11-05', '08:00'), date: '2026-11-05', status: 'alindi' }], '2026-11-05');
    expect(nextDose(d, '09:00').time).toBe('14:00');
    expect(nextDose(d, '21:00')).toBeNull();
  });
});

describe('özet ve metin', () => {
  it('dönem özeti', () => {
    const logs = [{ medicationId: 'm1', status: 'alindi' }, { medicationId: 'm1', status: 'alindi' }, { medicationId: 'm1', status: 'atlandi' }, { medicationId: 'x', status: 'alindi' }];
    expect(periodSummary(med(), logs)).toEqual({ taken: 2, skipped: 1, total: 21, days: 7 });
  });
  it('hatırlatma metni kişiyi ve aç/tok bilgisini taşır', () => {
    expect(medLine(med(), 'Aslan')).toBe('Aslan · D vitamini · 5 damla · tok karnına');
    expect(medLine(med({ meal: 'fark_etmez' }), 'Aslan')).toBe('Aslan · D vitamini · 5 damla');
  });
  it('kişiler: iki üye + bağımlı', () => {
    const p = medPeople({ members: ['A', 'B'], profiles: { A: { name: 'Semihcan', initial: 'S' } }, dependents: [{ id: 'aslan', name: 'Aslan', initial: 'A' }] }, 'A');
    expect(p.map((x) => x.id)).toEqual(['A', 'B', 'aslan']);
    expect(p[0].name).toBe('Semihcan');
    expect(p[1].name).toBe('Eşi');
  });
});
