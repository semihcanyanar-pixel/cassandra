import { describe, it, expect } from 'vitest';
import { ageDays, leftDays, fridgeState, ageText, leftText, sortFridge, urgentCount } from '../src/lib/fridge.js';
import { buildBackup, restoreOps, parseBackup } from '../src/lib/backup.js';

const T = '2026-11-05';
const it1 = (o) => ({ id: 'x', name: 'Süt', kind: 'urun', openedOn: '2026-11-03', shelfDays: 4, ...o });

describe('buzdolabı', () => {
  it('geçen gün ve kalan gün hesaplanır', () => {
    expect(ageDays(it1(), T)).toBe(2);
    expect(leftDays(it1(), T)).toBe(2);
    expect(leftDays(it1({ shelfDays: null }), T)).toBeNull();
    expect(ageDays(it1({ openedOn: '2026-11-09' }), T)).toBe(0); // a future date never gives a negative age
  });
  it('durum: kalan süreye göre', () => {
    expect(fridgeState(it1({ openedOn: '2026-11-05' }), T)).toBe('ok');
    expect(fridgeState(it1({ openedOn: '2026-11-02' }), T)).toBe('soon'); // 1 day left
    expect(fridgeState(it1({ openedOn: '2026-11-01' }), T)).toBe('soon'); // last day
    expect(fridgeState(it1({ openedOn: '2026-10-31' }), T)).toBe('late');
    expect(fridgeState(it1({ shelfDays: null }), T)).toBe('plain');
  });
  it('metinler: ürün açıldı, yemek yapıldı; kalan süre', () => {
    expect(ageText(it1({ openedOn: T }), T)).toBe('Bugün açıldı');
    expect(ageText(it1({ openedOn: '2026-11-04', kind: 'yemek' }), T)).toBe('Dün yapıldı');
    expect(ageText(it1(), T)).toBe('2 gün önce açıldı');
    expect(leftText(it1(), T)).toBe('2 gün kaldı');
    expect(leftText(it1({ openedOn: '2026-11-02' }), T)).toBe('Yarın son gün');
    expect(leftText(it1({ openedOn: '2026-11-01' }), T)).toBe('Bugün son gün');
    expect(leftText(it1({ openedOn: '2026-10-30' }), T)).toBe('2 gün geçti');
    expect(leftText(it1({ shelfDays: null }), T)).toBeNull();
  });
  it('en acil olan başa, süresizler sona; acil sayısı', () => {
    const list = [it1({ id: 'a', shelfDays: null, openedOn: '2026-10-20' }), it1({ id: 'b' }), it1({ id: 'c', openedOn: '2026-10-30' }), it1({ id: 'd', openedOn: '2026-11-02' })];
    expect(sortFridge(list, T).map((x) => x.id)).toEqual(['c', 'd', 'b', 'a']);
    expect(urgentCount(list, T)).toBe(2);
  });
  it('yedeğe girer ve geri yüklenince fridgeItems koleksiyonuna yazılır', () => {
    const session = { me: { uid: 'u1', name: 'S' }, hid: 'h1' };
    const text = JSON.stringify(buildBackup({ session, data: {}, house: { fridge: [{ id: 'f1', name: 'Süt', kind: 'urun', openedOn: T, shelfDays: 3 }] } }));
    const { backup } = parseBackup(text, 'u1');
    expect(restoreOps(backup, { uid: 'u1', hid: 'h1', includeHousehold: true }).map((o) => o.path.join('/'))).toEqual(['households/h1/fridgeItems/f1']);
  });
});
