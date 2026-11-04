import { auth } from './firebase.js';

// Cloudflare Worker base URL (no secrets here; the Gemini key lives only in the Worker).
export const WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
export const workerConfigured = Boolean(WORKER_URL);

export async function callWorker(path, body) {
  if (!workerConfigured) throw new Error('worker-not-configured');
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = new Error(`worker-${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// webcal:// link the iPhone turns into a calendar subscription.
export const webcalUrl = (token, kind) => `${WORKER_URL.replace(/^https?:/, 'webcal:')}/cal/${token}${kind === 'med' ? '/med' : ''}.ics`;
