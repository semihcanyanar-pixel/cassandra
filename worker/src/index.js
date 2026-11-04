import { verifyIdToken } from './jwt.js';
import { buildEventsIcs, buildMedIcs } from './ics.js';

// Bindings: KV (namespace), GEMINI_API_KEY (secret), FIREBASE_PROJECT_ID, ALLOWED_ORIGINS (comma list), GEMINI_MODEL (optional).
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;
const TOKEN = /^[0-9a-f]{48}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const REPEATS = ['none', 'weekly', 'monthly', 'yearly'];
const REMINDS = ['none', 'at', '30m', '2h', '1d'];
const LIMITS = { ai: 10, sync: 300 }; // per user per day

const cors = (env, req) => {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
};
const reply = (env, req, body, status = 200, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req), ...extra },
});

async function rateLimit(env, uid, kind) {
  const key = `rl:${kind}:${uid}:${new Date().toISOString().slice(0, 10)}`;
  const n = Number(await env.KV.get(key)) || 0;
  if (n >= LIMITS[kind]) return false;
  await env.KV.put(key, String(n + 1), { expirationTtl: 172800 });
  return true;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanEvents(list) {
  return (Array.isArray(list) ? list : []).slice(0, 1000).flatMap((e) => {
    if (!e || !ID.test(e.id || '') || !ISO.test(e.date || '')) return [];
    const time = HM.test(e.time || '') ? e.time : null;
    return [{
      uid: `${e.scope === 'kisisel' ? 'p' : 'f'}-${e.id}`, title: str(e.title, 120) || 'Kayıt', date: e.date, time,
      repeat: REPEATS.includes(e.repeat) ? e.repeat : 'none', remind: REMINDS.includes(e.remind) ? e.remind : 'none',
    }];
  });
}
function cleanMeds(list) {
  return (Array.isArray(list) ? list : []).slice(0, 200).flatMap((m) => {
    if (!m || !ID.test(m.id || '') || !ISO.test(m.startDate || '') || !ISO.test(m.endDate || '') || m.endDate < m.startDate) return [];
    const times = (Array.isArray(m.times) ? m.times : []).filter((t) => HM.test(t)).slice(0, 6);
    return times.length ? [{ id: m.id, times, startDate: m.startDate, endDate: m.endDate, line: str(m.line, 200) || 'İlaç' }] : [];
  });
}

async function auth(env, req) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return await verifyIdToken(h.slice(7), env.FIREBASE_PROJECT_ID); } catch { return null; }
}

async function handleSync(env, req, uid) {
  const body = await req.json().catch(() => null);
  if (!body || !TOKEN.test(body.token || '')) return reply(env, req, { error: 'bad token' }, 400);
  const owner = await env.KV.get(`owner:${body.token}`);
  if (owner && owner !== uid) return reply(env, req, { error: 'forbidden' }, 403);
  if (!(await rateLimit(env, uid, 'sync'))) return reply(env, req, { error: 'rate' }, 429);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  await env.KV.put(`owner:${body.token}`, uid);
  await env.KV.put(`ev:${body.token}`, buildEventsIcs(cleanEvents(body.events), stamp));
  await env.KV.put(`med:${body.token}`, buildMedIcs(cleanMeds(body.meds), stamp));
  // Token rotation: the old link stops working (only if this user owned it).
  if (TOKEN.test(body.prevToken || '') && body.prevToken !== body.token && (await env.KV.get(`owner:${body.prevToken}`)) === uid) {
    await Promise.all(['owner', 'ev', 'med'].map((p) => env.KV.delete(`${p}:${body.prevToken}`)));
  }
  return reply(env, req, { ok: true });
}

async function serveIcs(env, req, token, kind) {
  const ics = await env.KV.get(`${kind}:${token}`);
  if (!ics) return new Response('Not found', { status: 404 });
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
}

function cleanInsightInput(body) {
  const acts = (Array.isArray(body?.activities) ? body.activities : []).slice(0, 12).map((a) => ({
    ad: str(a?.name, 40),
    haftalik_hedef_dk: Number.isFinite(a?.weeklyTargetMin) ? Math.round(a.weeklyTargetMin) : null,
    son_4_hafta_dk: (Array.isArray(a?.weeks) ? a.weeks : []).slice(0, 4).map((n) => (Number.isFinite(n) ? Math.round(n) : 0)),
  })).filter((a) => a.ad);
  return acts;
}

async function gemini(env, prompt) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
  });
  if (!r.ok) return { fail: r.status };
  try {
    const data = await r.json();
    return { json: JSON.parse(data.candidates[0].content.parts[0].text) };
  } catch { return { fail: 'bad output' }; }
}

async function handleInsight(env, req, uid) {
  const acts = cleanInsightInput(await req.json().catch(() => null));
  if (!acts.length) return reply(env, req, { error: 'no data' }, 400);
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin aktivitelerinin son 4 haftalık toplam süreleri (dakika; dizinin son elemanı içinde bulunulan hafta, henüz bitmemiş olabilir) ve varsa haftalık hedefleri var.\n'
    + 'Türkçe, sıcak ve kısa (en çok 3 cümle) bir yorum yaz ve en çok iki somut öneri ver. Tıbbi ya da finansal tavsiye verme. Veride olmayan şeyi uydurma.\n'
    + `Yalnızca şu JSON biçiminde yanıt ver: {"yorum": string, "oneriler": [string]}\n\n${JSON.stringify(acts)}`;
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail }, 502);
  const p = g.json;
  return reply(env, req, { text: str(p.yorum, 600), tips: (Array.isArray(p.oneriler) ? p.oneriler : []).slice(0, 2).map((t) => str(t, 240)) });
}

function cleanDailyInput(body) {
  const acts = (Array.isArray(body?.activities) ? body.activities : []).slice(0, 12).map((a) => ({
    ad: str(a?.name, 40),
    bugun_dk: Number.isFinite(a?.todayMin) ? Math.round(a.todayMin) : 0,
    gunluk_hedef_dk: Number.isFinite(a?.dailyTargetMin) ? Math.round(a.dailyTargetMin) : null,
    son_7_gun_dk: (Array.isArray(a?.last7) ? a.last7 : []).slice(0, 7).map((n) => (Number.isFinite(n) ? Math.round(n) : 0)),
  })).filter((a) => a.ad);
  const hour = Number.isFinite(body?.hour) ? Math.min(23, Math.max(0, Math.round(body.hour))) : null;
  const streak = Number.isFinite(body?.streak) ? Math.max(0, Math.round(body.streak)) : 0;
  return { acts, hour, streak };
}

async function handleDaily(env, req, uid) {
  const { acts, hour, streak } = cleanDailyInput(await req.json().catch(() => null));
  if (!acts.length) return reply(env, req, { error: 'no data' }, 400);
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin bugünkü aktivite süreleri (dakika), günlük hedefleri, son 7 günün süreleri (sonuncusu bugün) ve gün serisi var. '
    + `Şu an günün saati ${hour ?? 'bilinmiyor'} (gün henüz bitmemiş olabilir).\n`
    + 'İki şey yaz, Türkçe ve sıcak bir dille: (1) "degerlendirme": bugünün kısa değerlendirmesi, en çok 2 cümle, veride olmayan şeyi uydurma. '
    + '(2) "motivasyon": kişinin motivasyonunu sürdürmesine yardım eden kısa bir söz, bilgi ya da ipucu (alışkanlık oluşturma, süreklilik, dinlenme gibi), en çok 2 cümle. Gerçek bir kişiye atfedilmiş alıntı verme, kaynak uydurma. Tıbbi ya da finansal tavsiye verme. '
    + 'Yalnızca şu JSON biçiminde yanıt ver: {"degerlendirme": string, "motivasyon": string}\n\n' + JSON.stringify({ gun_serisi: streak, aktiviteler: acts });
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail }, 502);
  return reply(env, req, { text: str(g.json.degerlendirme, 500), quote: str(g.json.motivasyon, 400) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });

    let m = url.pathname.match(/^\/cal\/([0-9a-f]{48})\.ics$/);
    if (m && req.method === 'GET') return serveIcs(env, req, m[1], 'ev');
    m = url.pathname.match(/^\/cal\/([0-9a-f]{48})\/med\.ics$/);
    if (m && req.method === 'GET') return serveIcs(env, req, m[1], 'med');

    if (req.method === 'POST' && ['/cal/sync', '/ai/weekly', '/ai/daily'].includes(url.pathname)) {
      const uid = await auth(env, req);
      if (!uid) return reply(env, req, { error: 'unauthorized' }, 401);
      if (url.pathname === '/cal/sync') return handleSync(env, req, uid);
      return url.pathname === '/ai/daily' ? handleDaily(env, req, uid) : handleInsight(env, req, uid);
    }
    return reply(env, req, { error: 'not found' }, 404);
  },
};
