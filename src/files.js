import { auth } from './firebase.js';
import { WORKER_URL, workerConfigured } from './worker.js';

export const filesEnabled = workerConfigured;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const isImage = (type) => /^image\//.test(type || '');

const authHeader = async () => ({ Authorization: `Bearer ${await auth.currentUser.getIdToken()}` });

// Shrinks a photo before upload: longest side 1600 px, JPEG 82 %. Keeps the original if that is not smaller.
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); // flatten transparency
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
    if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { /* unsupported format: upload as is */ }
  return file;
}

// Uploads one file. scope: 'personal' (only me) or 'family' (both household members). Returns { id, name, type, size }.
export async function uploadFile(file, scope) {
  if (!filesEnabled) throw new Error('files-not-configured');
  if (file.size > MAX_FILE_BYTES) { const e = new Error('too-large'); e.code = 'too-large'; throw e; }
  const r = await fetch(`${WORKER_URL}/files`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'X-Scope': scope, 'X-Name': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream' },
    body: file,
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) { const e = new Error(`upload-${r.status}`); e.code = r.status === 415 ? 'type' : r.status === 413 ? 'too-large' : 'failed'; throw e; }
  return r.json();
}

export async function deleteFile(id) {
  if (!filesEnabled) return;
  try { await fetch(`${WORKER_URL}/files/${id}`, { method: 'DELETE', headers: await authHeader() }); } catch (e) { console.warn('delete file', e.message); }
  urlCache.delete(id);
}

// Files are private, so they are fetched with the ID token and shown from a local blob URL (cached for the session).
const urlCache = new Map();
export function fileUrl(id) {
  if (!urlCache.has(id)) {
    urlCache.set(id, (async () => {
      const r = await fetch(`${WORKER_URL}/files/${id}`, { headers: await authHeader() });
      if (!r.ok) throw new Error(`file-${r.status}`);
      return URL.createObjectURL(await r.blob());
    })().catch((e) => { urlCache.delete(id); throw e; }));
  }
  return urlCache.get(id);
}
