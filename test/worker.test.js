import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/jwt.js', () => ({
  verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return t.slice(5); },
}));
const worker = (await import('../worker/src/index.js')).default;

let store;
const env = () => ({
  FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://ok.example', GEMINI_API_KEY: 'k',
  KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } },
});
const post = (path, body, auth = 'good-A', origin = 'https://ok.example') => new Request(`https://w.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body),
});
const gem = (obj) => async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

beforeEach(() => { store = new Map(); });

describe('Worker (Gemini vekili)', () => {
  it('belirteçsiz ya da geçersiz belirteçli istek 401', async () => {
    for (const p of ['/ai/weekly', '/ai/daily']) {
      expect((await worker.fetch(post(p, {}, null), env())).status).toBe(401);
      expect((await worker.fetch(post(p, {}, 'evil'), env())).status).toBe(401);
    }
  });
  it('eski takvim yolları artık yok', async () => {
    expect((await worker.fetch(post('/cal/sync', {}), env())).status).toBe(404);
  });
  it('CORS: yalnızca izinli kaynak', async () => {
    const ok = await worker.fetch(post('/ai/weekly', { activities: [] }), env());
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://ok.example');
    const bad = await worker.fetch(post('/ai/weekly', { activities: [] }, 'good-A', 'https://evil.example'), env());
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });
  it('haftalık: veri yoksa 400, Gemini anahtar başlığıyla çağrılır, günlük sınır 429', async () => {
    expect((await worker.fetch(post('/ai/weekly', { activities: [] }), env())).status).toBe(400);
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => { calls.push({ url, init }); return gem({ yorum: 'İyi gidiyor', oneriler: ['a', 'b', 'c'] })(); });
    const body = { activities: [{ name: 'İngilizce', weeklyTargetMin: 180, weeks: [60, 90, 120, 30] }] };
    const r = await worker.fetch(post('/ai/weekly', body), env());
    expect(await r.json()).toEqual({ text: 'İyi gidiyor', tips: ['a', 'b'] });
    expect(calls[0].init.headers['x-goog-api-key']).toBe('k');
    expect(calls[0].url).not.toContain('key=');
    for (let i = 0; i < 9; i++) await worker.fetch(post('/ai/weekly', body), env());
    expect((await worker.fetch(post('/ai/weekly', body), env())).status).toBe(429);
    vi.unstubAllGlobals();
  });
  it('günlük: değerlendirme + motivasyon; kayıt yokken de çalışır', async () => {
    vi.stubGlobal('fetch', gem({ degerlendirme: 'Güzel gün', motivasyon: 'Küçük adımlar birikir' }));
    const r = await worker.fetch(post('/ai/daily', { activities: [{ name: 'Spor', todayMin: 40, dailyTargetMin: 60, last7: [0, 30, 0, 45, 40, 0, 40] }], hour: 20, streak: 3 }), env());
    expect(await r.json()).toEqual({ text: 'Güzel gün', quote: 'Küçük adımlar birikir' });
    const empty = await worker.fetch(post('/ai/daily', { activities: [], hour: 9, streak: 0 }), env());
    expect(empty.status).toBe(200);
    vi.unstubAllGlobals();
  });
  it('slot: sabah/öğle/akşam notu; geçersiz slot ya da boş veri 400', async () => {
    expect((await worker.fetch(post('/ai/slot', {}, null), env())).status).toBe(401);
    expect((await worker.fetch(post('/ai/slot', { slot: 'gece', tasks: [{ title: 'x' }] }), env())).status).toBe(400);
    expect((await worker.fetch(post('/ai/slot', { slot: 'sabah', tasks: [], activities: [] }), env())).status).toBe(400);
    let prompt = '';
    vi.stubGlobal('fetch', async (url, init) => { prompt = JSON.parse(init.body).contents[0].parts[0].text; return gem({ mesaj: 'Günaydın', motivasyon: 'Küçük adımlar birikir' })(); });
    const r = await worker.fetch(post('/ai/slot', { slot: 'aksam', hour: 20, tasks: [{ title: 'Faturayı öde', done: false }], activities: [{ name: 'Spor', todayMin: 0, dailyTargetMin: 60 }], streak: 2 }), env());
    expect(await r.json()).toEqual({ text: 'Günaydın', quote: 'Küçük adımlar birikir' });
    expect(prompt).toContain('AKŞAM');
    expect(prompt).toContain('Faturayı öde');
    vi.unstubAllGlobals();
  });
  it('Gemini hatası 502 döner', async () => {
    vi.stubGlobal('fetch', async () => new Response('x', { status: 403 }));
    expect((await worker.fetch(post('/ai/daily', { activities: [] }), env())).status).toBe(502);
    vi.unstubAllGlobals();
  });
});
