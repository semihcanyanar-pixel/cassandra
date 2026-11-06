import { generateVapid, sendPush } from './webpush.js';

// KV layout: `vapid` = { pub, priv } (generated once, the private key never leaves the Worker),
// `push:{uid}` = { subs: [{endpoint, keys}], items: [{id, t, title, body}], sent: [id] }, `push:index` = [uid].
const SUBJECT = 'https://semihcanyanar-pixel.github.io/cassandra/';
const HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const MAX_ITEMS = 400;
const GO = /^[a-zA-Z0-9:_-]{1,80}$/; // where a tap on the notification goes (see src/lib/deeplink.js)
const LATE_MS = 20 * 60 * 1000; // a reminder later than this is stale and skipped

export async function getVapid(env) {
  const cur = await env.KV.get('vapid', 'json');
  if (cur) return cur;
  const v = await generateVapid();
  await env.KV.put('vapid', JSON.stringify(v));
  return v;
}

const load = async (env, uid) => (await env.KV.get(`push:${uid}`, 'json')) || { subs: [], items: [], sent: [] };
const save = (env, uid, rec) => env.KV.put(`push:${uid}`, JSON.stringify(rec));
async function addToIndex(env, uid) {
  const idx = (await env.KV.get('push:index', 'json')) || [];
  if (!idx.includes(uid)) await env.KV.put('push:index', JSON.stringify([...idx, uid]));
}

export function validSub(s) {
  try {
    const u = new URL(s?.endpoint);
    return u.protocol === 'https:' && HOSTS.some((h) => h.test(u.hostname)) && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string'
      && s.keys.p256dh.length < 200 && s.keys.auth.length < 100;
  } catch { return false; }
}

export async function subscribe(env, uid, sub) {
  if (!validSub(sub)) return false;
  const rec = await load(env, uid);
  rec.subs = [...rec.subs.filter((x) => x.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }].slice(-5);
  await save(env, uid, rec);
  await addToIndex(env, uid);
  return true;
}

export async function unsubscribe(env, uid, endpoint) {
  const rec = await load(env, uid);
  rec.subs = rec.subs.filter((x) => x.endpoint !== endpoint);
  await save(env, uid, rec);
}

const cleanItems = (list) => (Array.isArray(list) ? list : []).slice(0, MAX_ITEMS).flatMap((i) => (
  i && typeof i.id === 'string' && i.id.length < 120 && Number.isFinite(i.t)
    ? [{ id: i.id, t: Math.round(i.t), title: String(i.title || 'Cassandra').slice(0, 80), body: String(i.body || '').slice(0, 200), ...(GO.test(i.go) ? { go: i.go } : {}) }] : []));

// Replaces the user's schedule. Skips the KV write when nothing changed (free-tier write limit).
export async function setSchedule(env, uid, items) {
  const rec = await load(env, uid);
  const next = cleanItems(items);
  const same = JSON.stringify(rec.items) === JSON.stringify(next);
  if (same) return { changed: false, count: next.length };
  const ids = new Set(next.map((i) => i.id));
  rec.items = next;
  rec.sent = rec.sent.filter((id) => ids.has(id));
  await save(env, uid, rec);
  return { changed: true, count: next.length };
}

// Sends one payload to all of a record's subscriptions; drops subscriptions the push service says are gone.
async function deliver(env, vapid, rec, payload) {
  let ok = 0;
  const alive = [];
  for (const s of rec.subs) {
    let status = 0;
    try { status = await sendPush(vapid, s, payload, { subject: SUBJECT }); } catch (e) { console.log('push send failed', String(e)); }
    if (status >= 200 && status < 300) ok++;
    if (status !== 404 && status !== 410) alive.push(s);
    else console.log('push subscription gone', status);
  }
  rec.subs = alive;
  return ok;
}

export async function sendTest(env, uid) {
  const rec = await load(env, uid);
  if (!rec.subs.length) return { sent: 0, devices: 0 };
  const sent = await deliver(env, await getVapid(env), rec, { title: 'Cassandra', body: `Bildirimler çalışıyor. Gönderildi: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, tag: `test-${Date.now()}` });
  await save(env, uid, rec);
  return { sent, devices: rec.subs.length };
}

// Per-user switches kept next to the subscriptions. partnerAdds === false: do not tell me when my partner adds shared items.
export async function setPrefs(env, uid, prefs) {
  const rec = await load(env, uid);
  const next = { ...(rec.prefs || {}), partnerAdds: prefs?.partnerAdds !== false };
  if (JSON.stringify(rec.prefs || {}) === JSON.stringify(next)) return { changed: false };
  rec.prefs = next;
  await save(env, uid, rec);
  return { changed: true };
}

// Notifies everyone else who has notifications on (the household partner) right now, e.g. "X added to the shopping list".
export async function notifyOthers(env, fromUid, { title, body, go }) {
  const idx = (await env.KV.get('push:index', 'json')) || [];
  const vapid = await getVapid(env);
  const payload = { title: String(title || 'Cassandra').slice(0, 80), body: String(body || '').slice(0, 200), tag: `n-${Date.now()}`, go: GO.test(go) ? go : undefined };
  let sent = 0;
  for (const uid of idx) {
    if (uid === fromUid) continue;
    const rec = await load(env, uid);
    if (!rec.subs.length || rec.prefs?.partnerAdds === false) continue;
    const before = rec.subs.length;
    sent += await deliver(env, vapid, rec, payload);
    if (rec.subs.length !== before) await save(env, uid, rec);
  }
  return { sent };
}

// Cron: every minute. Sends due reminders (up to LATE_MS late) once each.
export async function runDue(env, now = Date.now()) {
  const idx = (await env.KV.get('push:index', 'json')) || [];
  if (!idx.length) return 0;
  const vapid = await getVapid(env);
  let total = 0;
  for (const uid of idx) {
    const rec = await load(env, uid);
    const due = rec.items.filter((i) => i.t <= now && i.t > now - LATE_MS && !rec.sent.includes(i.id));
    if (!due.length || !rec.subs.length) continue;
    for (const i of due) {
      const ok = await deliver(env, vapid, rec, { title: i.title, body: i.body, tag: i.id, go: i.go });
      rec.sent.push(i.id);
      total += ok;
    }
    rec.sent = rec.sent.slice(-400);
    rec.items = rec.items.filter((i) => i.t > now - 3600_000);
    await save(env, uid, rec);
  }
  return total;
}
