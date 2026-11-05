import { describe, it, expect } from 'vitest';
import { noteScope, notePath, filterNotes } from '../src/lib/notes.js';

const ctx = { uid: 'U1', hid: 'H1' };

describe('note scope', () => {
  it('kisisel goes to the user collection only', () => {
    expect(noteScope('kisisel')).toBe('personal');
    expect(notePath('kisisel', ctx)).toEqual(['users', 'U1', 'notes']);
  });
  it('aile (and legacy ev / aslan) go to the household', () => {
    expect(notePath('aile', ctx)).toEqual(['households', 'H1', 'notes']);
    expect(notePath('ev', ctx)).toEqual(['households', 'H1', 'notes']);
    expect(notePath('aslan', ctx)).toEqual(['households', 'H1', 'notes']);
  });
  it('unknown category never becomes personal by accident', () => {
    expect(noteScope(undefined)).toBe('household');
    expect(noteScope('KISISEL')).toBe('household');
  });
});

describe('filterNotes', () => {
  const shared = [{ id: 's1', category: 'ev' }, { id: 's2', category: 'aslan' }];
  const mine = [{ id: 'p1' }];
  it('all = shared + mine', () => expect(filterNotes(shared, mine, 'all').map((n) => n.id)).toEqual(['s1', 's2', 'p1']));
  it('kisisel = only mine', () => expect(filterNotes(shared, mine, 'kisisel').map((n) => n.id)).toEqual(['p1']));
  it('aile = all household notes (legacy ev/aslan included), never personal', () => {
    expect(filterNotes(shared, mine, 'aile').map((n) => n.id)).toEqual(['s1', 's2']);
    expect(filterNotes(shared, mine, 'aile').every((n) => n.category === 'aile')).toBe(true);
  });
});

import { toBlocks, cleanBlocks, numberLabels } from '../src/lib/notes.js';
const P = (o) => ({ t: '', k: 'p', d: false, l: 0, b: false, i: false, s: false, ...o });

describe('not satırları (biçimli metin + yuvarlak tik)', () => {
  it('eski not biçimlerini satırlara çevirir', () => {
    expect(toBlocks({ body: 'a\nb' })).toEqual([P({ t: 'a' }), P({ t: 'b' })]);
    expect(toBlocks({ items: [{ t: 'süt', done: true }] })).toEqual([P({ t: 'süt', k: 'cb', d: true })]);
    expect(toBlocks({})).toEqual([]);
  });
  it('bir önceki sürümün c bayrağı yuvarlak satıra dönüşür; tik yalnızca yuvarlakta anlamlı', () => {
    expect(toBlocks({ blocks: [{ t: 'x', c: false, d: true }, { t: 'y', c: true, d: true }] })).toEqual([P({ t: 'x' }), P({ t: 'y', k: 'cb', d: true })]);
  });
  it('yeni biçim okunur: tür, girinti ve biçim bayrakları', () => {
    expect(toBlocks({ blocks: [{ t: 'Başlık', k: 'h', b: true, i: true, s: true, l: 9 }] })).toEqual([P({ t: 'Başlık', k: 'h', b: true, i: true, s: true, l: 2 })]);
    expect(toBlocks({ blocks: [{ t: 'x', k: 'zzz' }] })[0].k).toBe('p');
  });
  it('kaydederken boş satırlar atılır, metin kırpılır', () => {
    expect(cleanBlocks([P({ t: ' a ', k: 'cb' }), P({ t: '  ' }), P({ t: 'b', d: true })])).toEqual([P({ t: 'a', k: 'cb' }), P({ t: 'b' })]);
  });
  it('numaralı satırlar sırayla sayılır, araya başka satır girince yeniden başlar', () => {
    const b = [P({ k: 'ol' }), P({ k: 'ol' }), P({ k: 'ol', l: 1 }), P({ k: 'ol', l: 1 }), P({ k: 'ol' }), P({ k: 'p' }), P({ k: 'ol' })];
    expect(numberLabels(b)).toEqual(['1.', '2.', '1.', '2.', '3.', null, '1.']);
  });
});
