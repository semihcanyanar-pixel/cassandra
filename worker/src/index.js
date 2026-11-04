import { verifyIdToken } from './jwt.js';

// Gemini proxy. Bindings: KV (rate limit), GEMINI_API_KEY (secret), FIREBASE_PROJECT_ID, ALLOWED_ORIGINS (comma list), GEMINI_MODEL (optional).
const LIMITS = { ai: 10 }; // per user per day

const cors = (env, req) => {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};
const reply = (env, req, body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req) },
});

async function rateLimit(env, uid, kind) {
  const key = `rl:${kind}:${uid}:${new Date().toISOString().slice(0, 10)}`;
  const n = Number(await env.KV.get(key)) || 0;
  if (n >= LIMITS[kind]) return false;
  await env.KV.put(key, String(n + 1), { expirationTtl: 172800 });
  return true;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? Math.round(v) : 0);

async function auth(env, req) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return await verifyIdToken(h.slice(7), env.FIREBASE_PROJECT_ID); } catch { return null; }
}

async function gemini(env, prompt) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    console.log('gemini error', r.status, body.slice(0, 400));
    let msg = '';
    try { msg = JSON.parse(body).error?.message || ''; } catch { /* not json */ }
    return { fail: r.status, detail: msg.slice(0, 200) };
  }
  try {
    const data = await r.json();
    return { json: JSON.parse(data.candidates[0].content.parts[0].text) };
  } catch { return { fail: 'bad output' }; }
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
  return reply(env, req, { text: str(g.json.degerlendirme, 500), quote: str(g.json.motivasyon, 400) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    if (req.method === 'POST' && (url.pathname === '/ai/weekly' || url.pathname === '/ai/daily')) {
      const uid = await auth(env, req);
      if (!uid) return reply(env, req, { error: 'unauthorized' }, 401);
      return url.pathname === '/ai/daily' ? handleDaily(env, req, uid) : handleWeekly(env, req, uid);
    }
    return reply(env, req, { error: 'not found' }, 404);
  },
};
