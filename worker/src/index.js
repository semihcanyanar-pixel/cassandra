import { verifyIdToken } from './jwt.js';
import { getVapid, subscribe, unsubscribe, setSchedule, sendTest, runDue } from './push.js';

// Gemini proxy + web push. Bindings: KV (rate limit), GEMINI_API_KEY (secret), FIREBASE_PROJECT_ID, ALLOWED_ORIGINS (comma list), GEMINI_MODEL (optional).
const LIMITS = { ai: 10 }; // per user per day

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
const reply = (env, req, body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req) },
});

// Only SUCCESSFUL generations count towards the daily limit (failed/busy attempts are free).
const limitKey = (uid, kind) => `rl:${kind}:${uid}:${new Date().toISOString().slice(0, 10)}`;
async function rateLimit(env, uid, kind) {
  const n = Number(await env.KV.get(limitKey(uid, kind))) || 0;
  return n < LIMITS[kind];
}
async function recordUse(env, uid, kind) {
  const n = Number(await env.KV.get(limitKey(uid, kind))) || 0;
  await env.KV.put(limitKey(uid, kind), String(n + 1), { expirationTtl: 172800 });
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? Math.round(v) : 0);

async function auth(env, req) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return await verifyIdToken(h.slice(7), env.FIREBASE_PROJECT_ID); } catch { return null; }
}

// One quick call per model (12 s cap). Busy answers are not retried on the same model: we move on to the next one instead.
async function callModel(env, model, prompt) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      try {
        const data = await r.json();
        return { json: JSON.parse(data.candidates[0].content.parts[0].text) };
      } catch { return { fail: 'bad output' }; }
    }
    const body = await r.text().catch(() => '');
    console.log('gemini error', model, r.status, body.slice(0, 300));
    let msg = '';
    try { msg = JSON.parse(body).error?.message || ''; } catch { /* not json */ }
    return { fail: r.status, detail: msg.slice(0, 200) };
  } catch (e) {
    console.log('gemini fetch failed', model, String(e));
    return { fail: 'timeout', detail: 'zaman aşımı' };
  }
}

// Text-capable "flash" models this key can use (so we are not tied to one name that may be overloaded or retired).
async function discoverModels(env) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash|lite/.test(m.name) && !/image|tts|live|audio|embed|robotics|computer|thinking/.test(m.name))
      .map((m) => m.name.replace('models/', ''));
  } catch { return []; }
}

async function gemini(env, prompt) {
  const first = [env.GEMINI_MODEL || 'gemini-3.8-flash', env.GEMINI_FALLBACK_MODEL || 'gemini-flash-latest'];
  let res = { fail: 0 };
  for (const m of first) {
    res = await callModel(env, m, prompt);
    if (res.json) return res;
  }
  // Both are busy or gone: try whatever else this key offers.
  const others = (await discoverModels(env)).filter((m) => !first.includes(m)).slice(0, 3);
  console.log('gemini fallback models', others.join(','));
  for (const m of others) {
    res = await callModel(env, m, prompt);
    if (res.json) return res;
  }
  return res;
}

function cleanWeekly(body) {
  return (Array.isArray(body?.activities) ? body.activities : []).slice(0, 12).map((a) => ({
    ad: str(a?.name, 40),
    haftalik_hedef_dk: Number.isFinite(a?.weeklyTargetMin) ? Math.round(a.weeklyTargetMin) : null,
    son_4_hafta_dk: (Array.isArray(a?.weeks) ? a.weeks : []).slice(0, 4).map(num),
  })).filter((a) => a.ad);
}

async function handleWeekly(env, req, uid) {
  const acts = cleanWeekly(await req.json().catch(() => null));
  if (!acts.length) return reply(env, req, { error: 'no data' }, 400);
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin aktivitelerinin son 4 haftalık toplam süreleri (dakika; dizinin son elemanı içinde bulunulan hafta, henüz bitmemiş olabilir) ve varsa haftalık hedefleri var.\n'
    + 'Türkçe, sıcak ve kısa (en çok 3 cümle) bir yorum yaz ve en çok iki somut öneri ver. Tıbbi ya da finansal tavsiye verme. Veride olmayan şeyi uydurma.\n'
    + `Yalnızca şu JSON biçiminde yanıt ver: {"yorum": string, "oneriler": [string]}\n\n${JSON.stringify(acts)}`;
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail, detail: g.detail || '' }, 502);
  const p = g.json;
  await recordUse(env, uid, 'ai');
  return reply(env, req, { text: str(p.yorum, 600), tips: (Array.isArray(p.oneriler) ? p.oneriler : []).slice(0, 2).map((t) => str(t, 240)) });
}

function cleanDaily(body) {
  const acts = (Array.isArray(body?.activities) ? body.activities : []).slice(0, 12).map((a) => ({
    ad: str(a?.name, 40),
    bugun_dk: num(a?.todayMin),
    gunluk_hedef_dk: Number.isFinite(a?.dailyTargetMin) ? Math.round(a.dailyTargetMin) : null,
    son_7_gun_dk: (Array.isArray(a?.last7) ? a.last7 : []).slice(0, 7).map(num),
  })).filter((a) => a.ad);
  const hour = Number.isFinite(body?.hour) ? Math.min(23, Math.max(0, Math.round(body.hour))) : null;
  const streak = Number.isFinite(body?.streak) ? Math.max(0, Math.round(body.streak)) : 0;
  return { acts, hour, streak };
}

// Works with no activity data too: then it only returns a motivation note.
async function handleDaily(env, req, uid) {
  const { acts, hour, streak } = cleanDaily(await req.json().catch(() => null));
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin bugünkü aktivite süreleri (dakika), günlük hedefleri, son 7 günün süreleri (sonuncusu bugün) ve gün serisi var; liste boş olabilir (henüz kayıt yok). '
    + `Şu an günün saati ${hour ?? 'bilinmiyor'} (gün henüz bitmemiş olabilir).\n`
    + 'İki şey yaz, Türkçe ve sıcak bir dille: (1) "degerlendirme": bugünün kısa değerlendirmesi, en çok 2 cümle, veride olmayan şeyi uydurma; kayıt yoksa nazikçe bugün için küçük bir başlangıç öner. '
    + '(2) "motivasyon": kişinin motivasyonunu sürdürmesine yardım eden kısa bir söz, bilgi ya da ipucu (alışkanlık oluşturma, süreklilik, dinlenme gibi), en çok 2 cümle. Gerçek bir kişiye atfedilmiş alıntı verme, kaynak uydurma. Tıbbi ya da finansal tavsiye verme. '
    + 'Yalnızca şu JSON biçiminde yanıt ver: {"degerlendirme": string, "motivasyon": string}\n\n' + JSON.stringify({ gun_serisi: streak, aktiviteler: acts });
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail, detail: g.detail || '' }, 502);
  await recordUse(env, uid, 'ai');
  return reply(env, req, { text: str(g.json.degerlendirme, 500), quote: str(g.json.motivasyon, 400) });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env).then((n) => { if (n) console.log('push delivered', n); }).catch((e) => console.log('push cron failed', String(e))));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    if (req.method === 'GET' && url.pathname === '/push/key') return reply(env, req, { key: (await getVapid(env)).pub });
    const authed = ['/ai/weekly', '/ai/daily', '/push/subscribe', '/push/unsubscribe', '/push/schedule', '/push/test'];
    if (req.method === 'POST' && authed.includes(url.pathname)) {
      const uid = await auth(env, req);
      if (!uid) return reply(env, req, { error: 'unauthorized' }, 401);
      if (url.pathname === '/ai/daily') return handleDaily(env, req, uid);
      if (url.pathname === '/ai/weekly') return handleWeekly(env, req, uid);
      const body = await req.json().catch(() => ({}));
      if (url.pathname === '/push/subscribe') return (await subscribe(env, uid, body.subscription)) ? reply(env, req, { ok: true }) : reply(env, req, { error: 'bad subscription' }, 400);
      if (url.pathname === '/push/unsubscribe') { await unsubscribe(env, uid, String(body.endpoint || '')); return reply(env, req, { ok: true }); }
      if (url.pathname === '/push/schedule') return reply(env, req, await setSchedule(env, uid, body.items));
      return reply(env, req, await sendTest(env, uid));
    }
    return reply(env, req, { error: 'not found' }, 404);
  },
};
