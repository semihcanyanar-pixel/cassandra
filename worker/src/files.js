// Note attachments (images + PDFs) stored in KV. Metadata: { uid, scope: 'personal' | 'family', name, type, size }.
// Access: personal files -> only the uploader; family files -> anyone who can read the household document (checked with the
// caller's own ID token against Firestore REST, so Firestore security rules decide who is a member).
export const MAX_BYTES = 20 * 1024 * 1024;
const DAILY_UPLOADS = 40;

// Real file type from the first bytes (the declared Content-Type is not trusted).
export function sniff(b) {
  const u = new Uint8Array(b.slice(0, 12));
  if (u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'image/jpeg';
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return 'image/png';
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return 'image/webp';
  if (u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return 'application/pdf'; // %PDF
  return null;
}

export async function isMember(env, token) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/households/${env.HOUSEHOLD_ID}?mask.fieldPaths=members`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    return r.ok;
  } catch { return false; }
}

const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, '0')).join('');
const FILE_ID = /^[0-9a-f]{32}$/;
export const isFileId = (s) => FILE_ID.test(s);

const canAccess = async (env, meta, uid, token) => (meta.scope === 'personal' ? meta.uid === uid : isMember(env, token));

// Returns { status, body } objects; index.js turns them into responses.
export async function uploadFile(env, req, uid, token) {
  const scope = req.headers.get('X-Scope') === 'family' ? 'family' : 'personal';
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BYTES) return { status: 413, body: { error: 'too large' } };
  if (scope === 'family' && !(await isMember(env, token))) return { status: 403, body: { error: 'forbidden' } };
  const day = `rl:file:${uid}:${new Date().toISOString().slice(0, 10)}`;
  const n = Number(await env.KV.get(day)) || 0;
  if (n >= DAILY_UPLOADS) return { status: 429, body: { error: 'rate' } };
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return { status: 413, body: { error: 'size' } };
  const type = sniff(buf);
  if (!type) return { status: 415, body: { error: 'unsupported type' } };
  let name = 'dosya';
  try { name = decodeURIComponent(req.headers.get('X-Name') || '') || name; } catch { /* keep default */ }
  name = name.replace(/[\r\n\u0000]/g, ' ').slice(0, 120);
  const id = hex(16);
  await env.KV.put(`f:${id}`, buf, { metadata: { uid, scope, name, type, size: buf.byteLength } });
  await env.KV.put(day, String(n + 1), { expirationTtl: 172800 });
  return { status: 200, body: { id, name, type, size: buf.byteLength } };
}

export async function readFile(env, id, uid, token) {
  const { value, metadata } = await env.KV.getWithMetadata(`f:${id}`, 'arrayBuffer');
  if (!value || !metadata) return { status: 404 };
  if (!(await canAccess(env, metadata, uid, token))) return { status: 403 };
  return { status: 200, value, meta: metadata };
}

export async function removeFile(env, id, uid, token) {
  const { metadata } = await env.KV.getWithMetadata(`f:${id}`);
  if (!metadata) return { status: 200 }; // already gone
  if (!(await canAccess(env, metadata, uid, token))) return { status: 403 };
  await env.KV.delete(`f:${id}`);
  return { status: 200 };
}
