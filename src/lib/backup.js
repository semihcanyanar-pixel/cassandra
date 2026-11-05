// Full copy of the data this person can see, as one JSON file: their own (personal) data plus the household's shared data.
// Attachments (images / PDFs) are listed in the notes but the files themselves are not part of the backup.
const PERSONAL = ['activities', 'logs', 'tasks', 'goals', 'notes', 'events', 'insights'];
const HOUSEHOLD = ['shopping', 'todos', 'notes', 'events', 'medications', 'medLogs'];

export function buildBackup({ session, data, house }, now = new Date()) {
  const pick = (src, keys) => Object.fromEntries(keys.map((k) => [k, src?.[k] || []]));
  return {
    app: 'cassandra',
    version: 1,
    exportedAt: now.toISOString(),
    user: { uid: session.me.uid, name: session.me.name },
    personal: pick(data, PERSONAL),
    household: { id: session.hid, ...pick(house, HOUSEHOLD) },
  };
}

export const backupName = (now = new Date()) => `cassandra-yedek-${now.toISOString().slice(0, 10)}.json`;

export const backupCounts = (b) => ({
  personal: Object.values(b.personal).reduce((s, v) => s + v.length, 0),
  household: Object.entries(b.household).filter(([k]) => k !== 'id').reduce((s, [, v]) => s + v.length, 0),
});

// Hands the file to the phone: share sheet when it can share files (iPhone: "Save to Files"), otherwise a normal download.
export async function saveBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const name = backupName();
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; /* else fall back to download */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

// ---- Restore -------------------------------------------------------------------------------------------------------
// Collection names inside Firestore (backup key -> collection).
export const PERSONAL_COLLECTIONS = { activities: 'activities', logs: 'logs', tasks: 'tasks', goals: 'goals', notes: 'notes', events: 'events', insights: 'insights' };
export const HOUSEHOLD_COLLECTIONS = { shopping: 'shoppingItems', todos: 'familyTodos', notes: 'notes', events: 'events', medications: 'medications', medLogs: 'medLogs' };

const goodId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..' && !id.startsWith('__');
const clean = (src, allowed) => Object.fromEntries(Object.keys(allowed).map((k) => [k, (Array.isArray(src?.[k]) ? src[k] : []).filter((d) => d && typeof d === 'object' && goodId(d.id))]));

// Reads a backup file's text. Only this account's own backup is accepted (a personal backup of someone else is refused).
export function parseBackup(text, uid) {
  let b;
  try { b = JSON.parse(text); } catch { return { ok: false, error: 'Dosya okunamadı. Cassandra yedeği olmalı.' }; }
  if (!b || b.app !== 'cassandra' || b.version !== 1 || typeof b.personal !== 'object' || typeof b.household !== 'object') return { ok: false, error: 'Bu bir Cassandra yedeği değil.' };
  if (b.user?.uid !== uid) return { ok: false, error: 'Bu yedek başka bir hesaba ait, geri yüklenemez.' };
  const backup = { ...b, personal: clean(b.personal, PERSONAL_COLLECTIONS), household: { id: b.household.id, ...clean(b.household, HOUSEHOLD_COLLECTIONS) } };
  return { ok: true, backup, counts: backupCounts(backup) };
}

// The writes a restore performs: same ids are overwritten with the backup version, nothing is deleted.
export function restoreOps(backup, { uid, hid, includeHousehold }) {
  const ops = [];
  for (const [k, name] of Object.entries(PERSONAL_COLLECTIONS)) for (const { id, ...data } of backup.personal[k] || []) ops.push({ path: ['users', uid, name, id], data });
  if (includeHousehold && backup.household.id === hid) {
    for (const [k, name] of Object.entries(HOUSEHOLD_COLLECTIONS)) for (const { id, ...data } of backup.household[k] || []) ops.push({ path: ['households', hid, name, id], data });
  }
  return ops;
}

// Firestore timestamps become { seconds, nanoseconds } in JSON; this turns them back with `make(seconds, nanoseconds)`.
export function reviveTimestamps(v, make) {
  if (Array.isArray(v)) return v.map((x) => reviveTimestamps(x, make));
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number' && keys.every((k) => ['seconds', 'nanoseconds', 'type'].includes(k))) return make(v.seconds, v.nanoseconds);
    return Object.fromEntries(keys.map((k) => [k, reviveTimestamps(v[k], make)]));
  }
  return v;
}
