// Where a note lives is decided ONLY by the category the user picked (SPEC §5: never leak personal data to the household).
export const NOTE_CATEGORIES = [
  { value: 'aile', label: 'Aile' },
  { value: 'kisisel', label: 'Kişisel' },
];
// Older household notes were saved as 'ev' / 'aslan'; they all count as 'aile' now.
export const normalizeCategory = (c) => (c === 'kisisel' ? 'kisisel' : 'aile');

export const noteScope = (category) => (category === 'kisisel' ? 'personal' : 'household');

export function notePath(category, { uid, hid }) {
  return noteScope(category) === 'personal' ? ['users', uid, 'notes'] : ['households', hid, 'notes'];
}

export const SHOP_CATEGORIES = [
  { value: 'market', label: 'Market' },
  { value: 'ev', label: 'Ev' },
  { value: 'aslan', label: 'Aslan' },
];

export const categoryLabel = (list, value) => list.find((c) => c.value === value)?.label || value;

// Notes shown for a filter chip. `all` = household notes + my personal notes.
export function filterNotes(householdNotes, personalNotes, filter) {
  const mine = personalNotes.map((n) => ({ ...n, category: 'kisisel' }));
  const shared = householdNotes.map((n) => ({ ...n, category: 'aile' }));
  if (filter === 'kisisel') return mine;
  if (filter === 'aile') return shared;
  return [...shared, ...mine];
}
