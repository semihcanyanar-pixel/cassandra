import { describe, it, expect } from 'vitest';
import { buildBackup, backupCounts, backupName } from '../src/lib/backup.js';
import { taskItems, localMs } from '../src/lib/push.js';
import { filterNotes } from '../src/lib/notes.js';

describe('yedek', () => {
  const session = { me: { uid: 'u1', name: 'Semih' }, hid: 'hane1' };
  it('kişisel ve ortak veriyi tek dosyada toplar, eksik koleksiyonlar boş liste olur', () => {
    const b = buildBackup({ session, data: { notes: [{ id: 'n' }], logs: [{ id: 'l' }, { id: 'm' }] }, house: { todos: [{ id: 't' }] } }, new Date('2026-11-05T10:00:00Z'));
    expect(b).toMatchObject({ app: 'cassandra', version: 1, exportedAt: '2026-11-05T10:00:00.000Z', user: { uid: 'u1' } });
    expect(b.personal.activities).toEqual([]);
    expect(b.household.id).toBe('hane1');
    expect(backupCounts(b)).toEqual({ personal: 3, household: 1 });
    expect(backupName(new Date('2026-11-05T10:00:00Z'))).toBe('cassandra-yedek-2026-11-05.json');
  });
});

describe('görev hatırlatması', () => {
  const today = '2026-11-05'; // Thursday (weekday 3, Monday = 0)
  it('saatsiz görev bildirim üretmez', () => {
    expect(taskItems([{ id: 'a', title: 'x', repeat: 'daily', date: today }], today)).toEqual([]);
  });
  it('her gün tekrarlı görev her gün, tik atılan gün hariç', () => {
    const t = { id: 'a', title: 'Vitamin', repeat: 'daily', date: today, remindTime: '09:00', doneDates: [today] };
    const items = taskItems([t], today, 2);
    expect(items.map((i) => i.id)).toEqual(['t-a-2026-11-06', 't-a-2026-11-07']);
    expect(items[0]).toMatchObject({ title: 'Vitamin', t: localMs('2026-11-06', '09:00') });
  });
  it('belirli günler görevi yalnızca o günlerde (Pzt-Çar-Cum)', () => {
    const t = { id: 'b', title: 'Çanta', repeat: 'days', days: [0, 2, 4], date: today, remindTime: '20:00' };
    expect(taskItems([t], today, 7).map((i) => i.id)).toEqual(['t-b-2026-11-06', 't-b-2026-11-09', 't-b-2026-11-11']);
  });
  it('tek seferlik görev yalnızca kendi gününde ve yapılmadıysa', () => {
    const t = { id: 'c', title: 'Fatura', repeat: 'none', date: '2026-11-07', remindTime: '10:30', done: false };
    expect(taskItems([t], today, 7).map((i) => i.id)).toEqual(['t-c-2026-11-07']);
    expect(taskItems([{ ...t, done: true }], today, 7)).toEqual([]);
  });
});

describe('sabit notlar', () => {
  it('sabit notlar her filtrede başa gelir, grup içi sıra korunur', () => {
    const shared = [{ id: 's1' }, { id: 's2', pinned: true }];
    const mine = [{ id: 'p1', pinned: true }, { id: 'p2' }];
    expect(filterNotes(shared, mine, 'all').map((n) => n.id)).toEqual(['s2', 'p1', 's1', 'p2']);
    expect(filterNotes(shared, mine, 'aile').map((n) => n.id)).toEqual(['s2', 's1']);
    expect(filterNotes(shared, mine, 'kisisel').map((n) => n.id)).toEqual(['p1', 'p2']);
  });
});
