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

// A note is a list of lines. Each line: { t: text, k: kind, d: done (circle lines), l: indent 0..2, b: bold, i: italic, s: strikethrough }.
// Kinds: p paragraph, h heading, s subheading, ul bullet, ol numbered, cb round checkbox (like iPhone Notes).
// Older notes: `blocks` with { c } (checklist flag), `items` (all checklist) or `body` (plain text) are converted on read.
export const KINDS = ['p', 'h', 's', 'ul', 'ol', 'cb'];
export const normBlock = (b) => {
  const k = KINDS.includes(b.k) ? b.k : b.c ? 'cb' : 'p';
  return { t: b.t || '', k, d: k === 'cb' && Boolean(b.d), l: Math.min(2, Math.max(0, Number(b.l) || 0)), b: Boolean(b.b), i: Boolean(b.i), s: Boolean(b.s) };
};
export function toBlocks(note) {
  if (Array.isArray(note?.blocks)) return note.blocks.map(normBlock);
  if (Array.isArray(note?.items)) return note.items.map((i) => normBlock({ t: i.t, k: 'cb', d: i.done }));
  if (note?.body) return note.body.split('\n').map((t) => normBlock({ t }));
  return [];
}
export const cleanBlocks = (blocks) => blocks.map((b) => normBlock({ ...b, t: (b.t || '').trim() })).filter((b) => b.t);

// Word-level formatting lives inside the line text as markers: **bold**, __italic__, ~~strikethrough~~.
export const MARKS = { b: '**', i: '__', s: '~~' };
const MARK_RE = /(\*\*|__|~~)/;

// Splits a line into runs [{ text, b, i, s }]. A marker with no partner stays literal text.
export function parseInline(t) {
  const parts = String(t || '').split(MARK_RE);
  const left = { '**': 0, '__': 0, '~~': 0 };
  parts.forEach((p) => { if (p in left) left[p] += 1; });
  const open = { '**': false, '__': false, '~~': false };
  const runs = [];
  parts.forEach((p) => {
    if (p in open) {
      // the last marker of an odd count has no partner
      left[p] -= 1;
      if (open[p] || left[p] > 0) { open[p] = !open[p]; return; }
      runs.push({ text: p, b: open['**'], i: open['__'], s: open['~~'] });
      return;
    }
    if (p) runs.push({ text: p, b: open['**'], i: open['__'], s: open['~~'] });
  });
  return runs;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Marker text -> HTML for the editable line (<b>, <i>, <s>).
export const toHtml = (t) => parseInline(t).map((r) => {
  let h = esc(r.text);
  if (r.s) h = `<s>${h}</s>`;
  if (r.i) h = `<i>${h}</i>`;
  if (r.b) h = `<b>${h}</b>`;
  return h;
}).join('');
// Text without the markers (for search / summaries).
export const plainText = (t) => parseInline(t).map((r) => r.text).join('');

// Wraps text[start,end) in the marker, or removes it when that selection is already wrapped. Returns { t, start, end }.
export function toggleMark(t, start, end, flag) {
  const m = MARKS[flag];
  const a = Math.max(0, Math.min(start, end)), z = Math.min(t.length, Math.max(start, end));
  const sel = t.slice(a, z);
  if (sel.startsWith(m) && sel.endsWith(m) && sel.length >= 2 * m.length) {
    const inner = sel.slice(m.length, sel.length - m.length);
    return { t: t.slice(0, a) + inner + t.slice(z), start: a, end: a + inner.length };
  }
  if (t.slice(a - m.length, a) === m && t.slice(z, z + m.length) === m) {
    return { t: t.slice(0, a - m.length) + sel + t.slice(z + m.length), start: a - m.length, end: z - m.length };
  }
  return { t: `${t.slice(0, a)}${m}${sel}${m}${t.slice(z)}`, start: a + m.length, end: z + m.length };
}

// The note's blocks with the round checkbox at `index` flipped.
export const toggleCheck = (blocks, index) => blocks.map((b, i) => (i === index && b.k === 'cb' ? { ...b, d: !b.d } : b));

// Labels for numbered lines ("1.", "2." ...): the count restarts whenever the run of numbered lines at that indent is broken.
export function numberLabels(blocks) {
  const counters = [0, 0, 0];
  return blocks.map((b) => {
    if (b.k !== 'ol') { for (let l = b.l; l < 3; l++) counters[l] = 0; return null; }
    counters[b.l] += 1;
    for (let l = b.l + 1; l < 3; l++) counters[l] = 0;
    return `${counters[b.l]}.`;
  });
}
