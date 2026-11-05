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
