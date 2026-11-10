import { useEffect } from 'preact/hooks';
import { callWorker, workerConfigured } from './worker.js';
import { saveDayPool } from './data.js';
import { today } from './lib/dates.js';
import { POOLS, dayIndex, refillNeeded } from './lib/dayNote.js';

const COOLDOWN_MS = 30 * 60 * 1000;
const cooled = (key) => {
  try {
    if (Date.now() - Number(localStorage.getItem(key) || 0) < COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch { /* storage blocked */ }
  return true;
};

// When the built-in lists of "Günün notu" are nearly used up, asks the Worker for the next batch (once; the first phone that opens the app does it)
// and keeps it in households/{hid}/dayPool, so both phones read the same new content and the day never shows an empty note.
export function useDayPoolRefill(hid, dayPool) {
  const sig = dayPool.map((d) => d.id).sort().join(',');
  useEffect(() => {
    if (!workerConfigured) return;
    const idx = dayIndex(today());
    for (const pool of POOLS) {
      const n = refillNeeded(pool, idx, dayPool);
      if (n === null || !cooled(`cassandra.pool.${pool}-${n}`)) continue;
      callWorker('/ai/pool', { pool }, 60000)
        .then((r) => { if (Array.isArray(r.items) && r.items.length >= 10) saveDayPool(hid, `${pool}-${n}`, { pool, n, items: r.items }); })
        .catch((e) => console.warn('day pool', pool, e.message));
    }
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
}
