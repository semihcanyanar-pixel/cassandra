import { verifyIdToken } from './jwt.js';
import { uploadFile, readFile, removeFile, isFileId } from './files.js';
import { getVapid, subscribe, unsubscribe, setSchedule, sendTest, runDue, notifyOthers, setPrefs } from './push.js';

// Gemini proxy + web push. Bindings: KV (rate limit), GEMINI_API_KEY (secret), FIREBASE_PROJECT_ID, ALLOWED_ORIGINS (comma list), GEMINI_MODEL (optional).
const LIMITS = { ai: 10, slot: 6, notify: 40, pool: 6 }; // per user per day

const cors = (env, req) => {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Scope, X-Name',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

const bearer = (req) => { const h = req.headers.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };

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
    tur: a?.kind === 'görev' ? 'görev' : 'aktivite',
    haftalik_hedef_gun: Number.isFinite(a?.weeklyTargetDays) ? Math.min(7, Math.max(1, Math.round(a.weeklyTargetDays))) : null,
    son_4_hafta_yapilan_gun: (Array.isArray(a?.weeks) ? a.weeks : []).slice(0, 4).map((n) => Math.min(7, num(n))),
    // optional extra: only when the person logged minutes for this activity
    son_4_hafta_dk: Array.isArray(a?.weekMinutes) ? a.weekMinutes.slice(0, 4).map(num) : undefined,
  })).filter((a) => a.ad);
}

async function handleWeekly(env, req, uid) {
  const acts = cleanWeekly(await req.json().catch(() => null));
  if (!acts.length) return reply(env, req, { error: 'no data' }, 400);
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin alışkanlıklarının (aktivite ya da tekrarlı görev) son 4 haftada haftada kaç GÜN yapıldığı (dizinin son elemanı içinde bulunulan hafta, henüz bitmemiş olabilir) ve haftalık hedef gün sayıları var. '
    + 'Değerlendirmeyi yapılan gün sayısına ve hedefe göre, süreklilik üzerinden yap; süre bilgisi (son_4_hafta_dk) yalnızca varsa ve ikincil bir ayrıntı olarak anılabilir, süre girilmemiş olması bir eksiklik değildir.\n'
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
    tur: a?.kind === 'görev' ? 'görev' : 'aktivite',
    bugun_yapildi: Boolean(a?.todayDone),
    son_7_gun_yapildi: (Array.isArray(a?.last7) ? a.last7 : []).slice(0, 7).map((n) => (num(n) > 0 ? 1 : 0)),
    haftalik_hedef_gun: Number.isFinite(a?.weeklyTargetDays) ? Math.min(7, Math.max(1, Math.round(a.weeklyTargetDays))) : null,
    bugun_dk: a?.todayMin ? num(a.todayMin) : undefined, // optional: only when minutes were logged
  })).filter((a) => a.ad);
  const hour = Number.isFinite(body?.hour) ? Math.min(23, Math.max(0, Math.round(body.hour))) : null;
  const streak = Number.isFinite(body?.streak) ? Math.max(0, Math.round(body.streak)) : 0;
  return { acts, hour, streak };
}

// Works with no activity data too: then it only returns a motivation note.
async function handleDaily(env, req, uid) {
  const { acts, hour, streak } = cleanDaily(await req.json().catch(() => null));
  if (!(await rateLimit(env, uid, 'ai'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Aşağıda bir kişinin alışkanlıklarının (aktivite ya da tekrarlı görev) bugün yapılıp yapılmadığı, son 7 günde hangi günlerin yapıldığı (1 = yapıldı, sonuncusu bugün), haftalık hedef gün sayıları ve gün serisi var; liste boş olabilir. '
    + 'Değerlendirmeyi yapılıp yapılmamaya ve sürekliliğe göre yap; süre (bugun_dk) yalnızca varsa anılabilir, süre girilmemiş olması bir eksiklik değildir. '
    + `Şu an günün saati ${hour ?? 'bilinmiyor'} (gün henüz bitmemiş olabilir).\n`
    + 'İki şey yaz, Türkçe ve sıcak bir dille: (1) "degerlendirme": bugünün kısa değerlendirmesi, en çok 2 cümle, veride olmayan şeyi uydurma; kayıt yoksa nazikçe bugün için küçük bir başlangıç öner. '
    + '(2) "motivasyon": kişinin motivasyonunu sürdürmesine yardım eden kısa bir söz, bilgi ya da ipucu (alışkanlık oluşturma, süreklilik, dinlenme gibi), en çok 2 cümle. Gerçek bir kişiye atfedilmiş alıntı verme, kaynak uydurma. Tıbbi ya da finansal tavsiye verme. '
    + 'Yalnızca şu JSON biçiminde yanıt ver: {"degerlendirme": string, "motivasyon": string}\n\n' + JSON.stringify({ gun_serisi: streak, aktiviteler: acts });
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail, detail: g.detail || '' }, 502);
  await recordUse(env, uid, 'ai');
  return reply(env, req, { text: str(g.json.degerlendirme, 500), quote: str(g.json.motivasyon, 400) });
}

const SLOT_GUIDE = {
  sabah: 'Şu an SABAH. Güne başlarken motive edici ol: bugünkü görevleri ve hedefleri kısaca say, küçük bir planlama önerisi ver (hangisiyle başlamalı, ne zaman yapmalı). Bugün hepsini halledebileceğini hissettir.',
  ogle: 'Şu an ÖĞLEDEN SONRA. Duruma göre konuş: hiçbir şeye başlanmamışsa "en az bir tanesini yapsan bile iyi olur ama hâlâ vakit var" tonunda, hangisinden başlanabileceğini söyle; ilerleme varsa tebrik et ve kalan en önemli şeyi öner.',
  aksam: 'Şu an AKŞAM. Gün sonu: çok şey yapılmışsa tebrik et ve kalan son şeyi tamamlamayı öner; hiçbir şey yapılmamışsa suçlamadan, en azından şunları yapabileceğini söyle (küçük, kolay olanı seç).',
};

function cleanSlot(body) {
  const slot = SLOT_GUIDE[body?.slot] ? body.slot : null;
  const tasks = (Array.isArray(body?.tasks) ? body.tasks : []).slice(0, 15).map((t) => ({ gorev: str(t?.title, 60), yapildi: Boolean(t?.done) })).filter((t) => t.gorev);
  const acts = (Array.isArray(body?.activities) ? body.activities : []).slice(0, 12).map((a) => ({
    aktivite: str(a?.name, 40), bugun_yapildi: Boolean(a?.todayDone), bugun_dk: a?.todayMin ? num(a.todayMin) : undefined,
    gunluk_hedef_dk: Number.isFinite(a?.dailyTargetMin) ? Math.round(a.dailyTargetMin) : null,
  })).filter((a) => a.aktivite);
  return { slot, tasks, acts, streak: Number.isFinite(body?.streak) ? Math.max(0, Math.round(body.streak)) : 0 };
}

// Automatic day note (morning / afternoon / evening) from today's tasks and activity progress.
async function handleSlot(env, req, uid) {
  const { slot, tasks, acts, streak } = cleanSlot(await req.json().catch(() => null));
  if (!slot || (!tasks.length && !acts.length)) return reply(env, req, { error: 'no data' }, 400);
  if (!(await rateLimit(env, uid, 'slot'))) return reply(env, req, { error: 'rate' }, 429);
  const prompt = 'Sen sıcak, motive edici ama baskı yapmayan bir kişisel asistansın. Aşağıda bir kişinin bugünkü görevleri, bugün yapıp yapmadığı aktiviteler (süre varsa ikincil bir ayrıntıdır, süre girilmemesi eksiklik değildir) ve gün serisi var.\n'
    + `${SLOT_GUIDE[slot]}\n`
    + 'Türkçe yaz, en çok 3 kısa cümle, "sen" diye hitap et. Veride olmayan görev ya da ilerleme uydurma; emoji kullanma; tıbbi ya da finansal tavsiye verme.\n'
    + 'Ayrıca "motivasyon" alanına, kişinin motivasyonunu sürdürmesine yardım eden kısa bir söz, bilgi ya da ipucu yaz (alışkanlık oluşturma, süreklilik, küçük adımlar, dinlenme gibi), en çok 2 cümle; her seferinde farklı bir konu seç. Gerçek bir kişiye atfedilmiş alıntı verme, kaynak uydurma.\n'
    + 'Yalnızca şu JSON biçiminde yanıt ver: {"mesaj": string, "motivasyon": string}\n\n' + JSON.stringify({ gun_serisi: streak, gorevler: tasks, aktiviteler: acts });
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail, detail: g.detail || '' }, 502);
  await recordUse(env, uid, 'slot');
  return reply(env, req, { text: str(g.json.mesaj, 420), quote: str(g.json.motivasyon, 300) });
}

// New batch of content for "Günün notu" (motivation sentences, quotes, parenting tips) when the built-in lists are nearly used up.
const POOL_PROMPTS = {
  motivation: 'Türkçe, kısa (en çok iki cümle), genel ve herkese uyan motivasyon cümleleri yaz. Belirli bir iş, görev, aktivite, spor ya da ev işinden söz etme; "bugün şunu yap" deme. Sıcak, yargılamayan, sade bir dil kullan; klişe tekrarlarından kaçın. Emoji kullanma.',
  quote: 'Dünya edebiyatından, şiirden, romanlardan, filmlerden, şarkılardan ve farklı ülkelerin atasözlerinden hayata dair kısa (en çok 25 kelime) alıntılar ver. YALNIZCA doğruluğundan ve kime ait olduğundan çok emin olduğun, iyi bilinen alıntıları ver; emin olmadığın, uydurma ya da yanlış atfedilmiş olabilecek hiçbir şey verme. Yabancı dildeki alıntıları Türkçeye çevirerek yaz. "by" alanına yazar ve eser (örn. "Albert Camus", "Küçük Prens, Saint-Exupéry") ya da atasözlerinde "Japon atasözü" gibi kültürü yaz. Şarkı sözlerinden en çok bir kısa dize al. Telif hakkı olan uzun parçalar verme.',
  tip: 'Çocuk gelişimi, eğitimi ve ebeveynlikte dikkat edilecek konularda Türkçe, kısa (en çok iki cümle), genel ve uygulanabilir ipuçları yaz. Yenidoğana özgü olmasın, genel olsun. Tıbbi tavsiye, ilaç, teşhis ya da kesin sağlık iddiası verme; yargılayıcı olma. Her ipucu farklı bir konuyu işlesin. Emoji kullanma.',
};

async function handlePool(env, req, uid) {
  const body = await req.json().catch(() => null);
  const pool = POOL_PROMPTS[body?.pool] ? body.pool : null;
  if (!pool) return reply(env, req, { error: 'bad pool' }, 400);
  if (!(await rateLimit(env, uid, 'pool'))) return reply(env, req, { error: 'rate' }, 429);
  const quote = pool === 'quote';
  const prompt = `${POOL_PROMPTS[pool]}
Tam olarak 60 öğe üret; hiçbiri birbirine benzemesin.
Yalnızca şu JSON biçiminde yanıt ver: ${quote ? '{"items": [{"t": string, "by": string}]}' : '{"items": [{"t": string}]}'}`;
  const g = await gemini(env, prompt);
  if (g.fail) return reply(env, req, { error: 'ai failed', status: g.fail }, 502);
  const items = (Array.isArray(g.json?.items) ? g.json.items : []).slice(0, 80).map((i) => (quote
    ? { t: str(i?.t, 300), by: str(i?.by, 120) }
    : { t: str(i?.t, 300) })).filter((i) => i.t.length > 8 && (!quote || i.by));
  if (items.length < 20) return reply(env, req, { error: 'too few' }, 502);
  await recordUse(env, uid, 'pool');
  return reply(env, req, { items });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env).then((n) => { if (n) console.log('push delivered', n); }).catch((e) => console.log('push cron failed', String(e))));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    if (req.method === 'GET' && url.pathname === '/push/key') return reply(env, req, { key: (await getVapid(env)).pub });
    // Note attachments: POST /files (upload), GET|DELETE /files/{id}
    if (url.pathname === '/files' || url.pathname.startsWith('/files/')) {
      const uid = await auth(env, req);
      if (!uid) return reply(env, req, { error: 'unauthorized' }, 401);
      const token = bearer(req);
      if (url.pathname === '/files' && req.method === 'POST') {
        const r = await uploadFile(env, req, uid, token);
        return reply(env, req, r.body, r.status);
      }
      const id = url.pathname.slice('/files/'.length);
      if (!isFileId(id)) return reply(env, req, { error: 'not found' }, 404);
      if (req.method === 'GET') {
        const r = await readFile(env, id, uid, token);
        if (r.status !== 200) return reply(env, req, { error: r.status === 404 ? 'not found' : 'forbidden' }, r.status);
        return new Response(r.value, {
          headers: { 'Content-Type': r.meta.type, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600', ...cors(env, req) },
        });
      }
      if (req.method === 'DELETE') {
        const r = await removeFile(env, id, uid, token);
        return reply(env, req, r.status === 200 ? { ok: true } : { error: 'forbidden' }, r.status);
      }
      return reply(env, req, { error: 'method' }, 405);
    }
    const authed = ['/ai/weekly', '/ai/daily', '/ai/slot', '/push/subscribe', '/push/unsubscribe', '/push/schedule', '/push/test', '/push/notify', '/push/prefs', '/ai/pool'];
    if (req.method === 'POST' && authed.includes(url.pathname)) {
      const uid = await auth(env, req);
      if (!uid) return reply(env, req, { error: 'unauthorized' }, 401);
      if (url.pathname === '/ai/daily') return handleDaily(env, req, uid);
      if (url.pathname === '/ai/slot') return handleSlot(env, req, uid);
      if (url.pathname === '/ai/weekly') return handleWeekly(env, req, uid);
      if (url.pathname === '/ai/pool') return handlePool(env, req, uid);
      const body = await req.json().catch(() => ({}));
      if (url.pathname === '/push/subscribe') return (await subscribe(env, uid, body.subscription)) ? reply(env, req, { ok: true }) : reply(env, req, { error: 'bad subscription' }, 400);
      if (url.pathname === '/push/unsubscribe') { await unsubscribe(env, uid, String(body.endpoint || '')); return reply(env, req, { ok: true }); }
      if (url.pathname === '/push/schedule') return reply(env, req, await setSchedule(env, uid, body.items));
      if (url.pathname === '/push/prefs') return reply(env, req, await setPrefs(env, uid, body));
      if (url.pathname === '/push/notify') {
        if (!(await rateLimit(env, uid, 'notify'))) return reply(env, req, { error: 'rate' }, 429);
        await recordUse(env, uid, 'notify');
        return reply(env, req, await notifyOthers(env, uid, { title: str(body.title, 80), body: str(body.body, 200), go: str(body.go, 80) }));
      }
      return reply(env, req, await sendTest(env, uid));
    }
    return reply(env, req, { error: 'not found' }, 404);
  },
};
