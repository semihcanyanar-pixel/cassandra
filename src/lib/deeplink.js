// Where a notification takes you. Stored as a short string in the push payload (`go`):
//   bugun | takvim | ev | todo | fridge | ilac | event:{aile|kisisel}:{id}
const TABS = new Set(['bugun', 'takvim']);
const ORTAK = new Set(['ev', 'todo', 'fridge', 'ilac']);

export const validGo = (s) => typeof s === 'string' && s.length <= 80 && /^[a-zA-Z0-9:_-]+$/.test(s);

// -> { tab, sub?, route? } or null
export function parseGo(s) {
  if (!validGo(s)) return null;
  if (TABS.has(s)) return { tab: s };
  if (ORTAK.has(s)) return { tab: 'ortak', sub: s };
  const m = /^event:(aile|kisisel):([a-zA-Z0-9_-]+)$/.exec(s);
  if (m) return { tab: 'takvim', route: { n: 'event', scope: m[1], id: m[2] } };
  return null;
}
