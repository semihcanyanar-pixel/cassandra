import { describe, it, expect } from 'vitest';
import { noteScope, notePath, filterNotes } from '../src/lib/notes.js';

const ctx = { uid: 'U1', hid: 'H1' };

describe('note scope', () => {
  it('kisisel goes to the user collection only', () => {
    expect(noteScope('kisisel')).toBe('personal');
    expect(notePath('kisisel', ctx)).toEqual(['users', 'U1', 'notes']);
  });
  it('ev / aslan go to the household', () => {
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
  it('ev excludes personal', () => expect(filterNotes(shared, mine, 'ev').map((n) => n.id)).toEqual(['s1']));
});
