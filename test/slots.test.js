import { describe, it, expect } from 'vitest';
import { currentSlot, slotDocId, latestNote, buildSlotInput, hasPlan, weeklyDue } from '../src/lib/slots.js';

describe('günün notu saatleri', () => {
  it('10, 15 ve 20 den itibaren; 10 dan önce yok', () => {
    expect(currentSlot(9)).toBeNull();
    expect(currentSlot(10).id).toBe('sabah');
    expect(currentSlot(14).id).toBe('sabah');
    expect(currentSlot(15).id).toBe('ogle');
    expect(currentSlot(19).id).toBe('ogle');
    expect(currentSlot(20).id).toBe('aksam');
    expect(currentSlot(23).id).toBe('aksam');
  });
  it('en yeni notu seçer', () => {
    const ins = [{ id: slotDocId('2026-11-05', 'sabah'), text: 'a' }, { id: slotDocId('2026-11-05', 'ogle'), text: 'b' }, { id: slotDocId('2026-11-04', 'aksam'), text: 'eski' }];
    expect(latestNote(ins, '2026-11-05').text).toBe('b');
    expect(latestNote(ins, '2026-11-06')).toBeNull();
  });
  it('girdi: bugünün görevleri ve aktivite süreleri', () => {
    const data = {
      tasks: [{ id: 't1', title: 'Vitamin', repeat: 'daily', date: '2026-11-01', doneDates: ['2026-11-05'] }, { id: 't2', title: 'Fatura', repeat: 'none', date: '2026-11-05', done: false }],
      activities: [{ id: 'a', name: 'Spor', dailyMinutes: 60, archived: false }],
      logs: [{ activityId: 'a', date: '2026-11-05', minutes: 20 }, { activityId: 'a', date: '2026-11-04', minutes: 30 }],
    };
    const i = buildSlotInput(data, '2026-11-05', 15);
    expect(i.slot).toBe('ogle');
    expect(i.tasks).toEqual([{ title: 'Vitamin', done: true }, { title: 'Fatura', done: false }]);
    expect(i.activities).toEqual([{ name: 'Spor', todayDone: true, todayMin: 20, dailyTargetMin: 60 }]);
    expect(hasPlan(i)).toBe(true);
    expect(hasPlan({ tasks: [], activities: [] })).toBe(false);
  });
  it('haftalık: yalnızca pazar 20:00 den sonra', () => {
    expect(weeklyDue(6, 19)).toBe(false);
    expect(weeklyDue(6, 20)).toBe(true);
    expect(weeklyDue(5, 22)).toBe(false);
  });
});
