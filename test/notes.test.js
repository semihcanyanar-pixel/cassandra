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
    expect(cleanBlocks([P({ t: ' a ', k: 'cb' }), P({ t: '  ' }), P({ t: 'b', d: true })])).toEqual([P({ t: 'a', k: 'cb' }), P({ t: '' }), P({ t: 'b' })]);
  });
  it('numaralı satırlar sırayla sayılır, araya başka satır girince yeniden başlar', () => {
    const b = [P({ k: 'ol' }), P({ k: 'ol' }), P({ k: 'ol', l: 1 }), P({ k: 'ol', l: 1 }), P({ k: 'ol' }), P({ k: 'p' }), P({ k: 'ol' })];
    expect(numberLabels(b)).toEqual(['1.', '2.', '1.', '2.', '3.', null, '1.']);
  });
});

import { parseInline, plainText, toggleMark, toggleCheck, toHtml } from '../src/lib/notes.js';
const R = (text, o = {}) => ({ text, b: false, i: false, s: false, ...o });

describe('kelime bazlı biçim', () => {
  it('işaretleri çalıştırmalara böler', () => {
    expect(parseInline('a **kalın** b __eğik__ ~~çizili~~')).toEqual([
      R('a '), R('kalın', { b: true }), R(' b '), R('eğik', { i: true }), R(' '), R('çizili', { s: true }),
    ]);
    expect(parseInline('**a __b__ c**')).toEqual([R('a ', { b: true }), R('b', { b: true, i: true }), R(' c', { b: true })]);
  });
  it('eşi olmayan işaret düz metin kalır', () => {
    expect(plainText('2 ** 3')).toBe('2 ** 3');
    expect(plainText('**açık')).toBe('**açık');
    expect(parseInline('**açık').every((r) => !r.b)).toBe(true);
  });
  it('düzenleme satırı için HTML üretir ve özel karakterleri kaçırır', () => {
    expect(toHtml('a **b** <x> __c__')).toBe('a <b>b</b> &lt;x&gt; <i>c</i>');
    expect(toHtml('**__x__**')).toBe('<b><i>x</i></b>');
  });
  it('seçimi sarar ve tekrar basınca çözer', () => {
    const a = toggleMark('merhaba dünya', 8, 13, 'b');
    expect(a).toEqual({ t: 'merhaba **dünya**', start: 10, end: 15 });
    expect(toggleMark(a.t, a.start, a.end, 'b')).toEqual({ t: 'merhaba dünya', start: 8, end: 13 });
    expect(toggleMark('x **y** z', 2, 7, 'b').t).toBe('x y z'); // selection includes the markers
  });
  it('yuvarlak tik yalnızca o satırda değişir', () => {
    const b = [P({ t: 'a', k: 'cb' }), P({ t: 'b', k: 'cb', d: true }), P({ t: 'c' })];
    expect(toggleCheck(b, 0).map((x) => x.d)).toEqual([true, true, false]);
    expect(toggleCheck(b, 1).map((x) => x.d)).toEqual([false, false, false]);
    expect(toggleCheck(b, 2)).toEqual(b);
  });
});

describe('Not boyut sınırları', () => {
  it('toplam karakter sayısı satırların toplamıdır; sınırlar genişletildi', async () => {
    const { noteLength, NOTE_LIMITS } = await import('../src/lib/notes.js');
    expect(noteLength([{ t: 'abc' }, { t: 'de' }, {}])).toBe(5);
    expect(NOTE_LIMITS.line).toBeGreaterThan(500);
    expect(NOTE_LIMITS.title).toBeGreaterThan(60);
  });
});

describe('Renk yardımcıları', () => {
  it('palet indeksi ya da özel #rrggbb kabul edilir; koyu renk açık yazı ister', async () => {
    const { actColor, isHex, inkKey } = await import('../src/components/ui.jsx');
    expect(actColor(3)).toBe('var(--act-3)');
    expect(actColor(undefined)).toBe('var(--act-0)');
    expect(actColor('#8e24aa')).toBe('#8e24aa');
    expect(isHex('red')).toBe(false);
    expect(inkKey('#101010')).toBe(6);
    expect(inkKey('#ffee88')).toBe(0);
    expect(inkKey(2)).toBe(2);
  });
});

describe('Kişisel not düzeni', () => {
  const mk = (id, category = 'aile', extra = {}) => ({ id, category, ...extra });
  it('önce sabitliler, sonra benim sıram; yerleştirilmemiş yeni notlar başta', async () => {
    const { arrangeNotes, noteKey, effectivePin } = await import('../src/lib/notes.js');
    const notes = [mk('new'), mk('a'), mk('b'), mk('c')];
    const prefs = { order: ['aile_c', 'aile_a', 'aile_b'], pins: { aile_b: true } };
    expect(arrangeNotes(notes, prefs).map((n) => n.id)).toEqual(['b', 'new', 'c', 'a']);
    expect(noteKey(mk('x', 'kisisel'))).toBe('kisisel_x');
    expect(effectivePin(mk('p', 'aile', { pinned: true }), {})).toBe(true); // older shared pin is the fallback
    expect(effectivePin(mk('p', 'aile', { pinned: true }), { pins: { aile_p: false } })).toBe(false); // my own choice wins
  });
  it('süzülmüş görünümde sürükleme, diğer notların yerini bozmaz', async () => {
    const { mergeOrder } = await import('../src/lib/notes.js');
    // full: A1 K1 A2 K2 A3 ; in the "aile" view A3 is dragged to the front
    expect(mergeOrder(['A1', 'K1', 'A2', 'K2', 'A3'], ['A3', 'A1', 'A2'])).toEqual(['A3', 'K1', 'A1', 'K2', 'A2']);
  });
});

describe('Satır hizalama', () => {
  it('geçerli hizalama saklanır, sola yaslı için alan eklenmez', async () => {
    const { normBlock } = await import('../src/lib/notes.js');
    expect(normBlock({ t: 'x', a: 'j' }).a).toBe('j');
    expect('a' in normBlock({ t: 'x' })).toBe(false);
    expect('a' in normBlock({ t: 'x', a: 'zzz' })).toBe(false);
  });
});

describe('Boş satırlar', () => {
  it('metin aralarındaki boş satır korunur; baştaki, sondaki ve boş madde atılır', async () => {
    const { cleanBlocks, visibleBlocks } = await import('../src/lib/notes.js');
    const P = (o) => ({ t: '', k: 'p', ...o });
    const out = cleanBlocks([P({}), P({ t: 'a' }), P({}), P({}), P({ t: 'b' }), P({ k: 'ul' }), P({})]);
    expect(out.map((b) => b.t)).toEqual(['a', '', '', 'b']);
    const vis = visibleBlocks([P({}), P({ t: 'a' }), P({}), P({ t: 'b' }), P({})]);
    expect(vis.map((b) => [b.t, b.idx])).toEqual([['a', 1], ['', 2], ['b', 3]]);
  });
});
