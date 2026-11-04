import { auth } from './firebase.js';

// Cloudflare Worker base URL (no secrets here; the Gemini key lives only in the Worker).
export const WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
export const workerConfigured = Boolean(WORKER_URL);

export async function callWorker(path, body, timeoutMs = 40000) {
  if (!workerConfigured) throw new Error('worker-not-configured');
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const e = new Error(`worker-${r.status}`);
    e.status = r.status; e.detail = j.detail || j.error || ''; e.upstream = j.status;
    throw e;
  }
  return r.json();
}

