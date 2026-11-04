import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/jwt.js', () => ({
  verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return t.slice(5); },
}));
const worker = (await import('../worker/src/index.js')).default;

const TOKEN_A = 'a'.repeat(48);
const TOKEN_B = 'b'.repeat(48);
let store;
const env = () => ({
  FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://ok.example', GEMINI_API_KEY: 'k',
  KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } },
});
const post = (path, body, auth = 'good-A', origin = 'https://ok.example') => new Request(`https://w.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body),
});
const ev = { id: 'e1', title: 'Hastane', date: '2026-11-07', time: '10:30', repeat: 'none', remind: 'at' };
const med = { id: 'm1', times: ['08:00'], startDate: '2026-11-03', endDate: '2026-11-09', line: 'Aslan · D vitamini' };

beforeEach(() => { store = new Map(); });

describe('Worker', () => {
  it('belirteçsiz ya da geçersiz belirteçli istek 401', async () => {
    expect((await worker.fetch(post('/cal/sync', { token: TOKEN_A }, null), env())).status).toBe(401);
    expect((await worker.fetch(post('/cal/sync', { token: TOKEN_A }, 'evil'), env())).status).toBe(401);
    expect((await worker.fetch(post('/ai/weekly', { activities: [] }, null), env())).status).toBe(401);
  });
  it('sync: akışları yazar, .ics olarak sunar', async () => {
    const r = await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [ev], meds: [med] }), env());
    expect(r.status).toBe(200);
    const cal = await worker.fetch(new Request(`https://w.example/cal/${TOKEN_A}.ics`), env());
    expect(cal.headers.get('Content-Type')).toContain('text/calendar');
    expect(await cal.text()).toContain('SUMMARY:Hastane');
    const m = await worker.fetch(new Request(`https://w.example/cal/${TOKEN_A}/med.ics`), env());
    expect(await m.text()).toContain('RRULE:FREQ=DAILY');
  });
  it('bilinmeyen token 404', async () => {
    expect((await worker.fetch(new Request(`https://w.example/cal/${TOKEN_B}.ics`), env())).status).toBe(404);
  });
  it('başkasının token ına yazamaz', async () => {
    await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [ev], meds: [] }, 'good-A'), env());
    const r = await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [], meds: [] }, 'good-B'), env());
    expect(r.status).toBe(403);
  });
  it('yenileme eski bağlantıyı siler; başkasınınkini silemez', async () => {
    await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [ev], meds: [] }, 'good-A'), env());
    await worker.fetch(post('/cal/sync', { token: TOKEN_B, prevToken: TOKEN_A, events: [], meds: [] }, 'good-A'), env());
    expect((await worker.fetch(new Request(`https://w.example/cal/${TOKEN_A}.ics`), env())).status).toBe(404);
    // C tries to delete B's feed via prevToken
    await worker.fetch(post('/cal/sync', { token: 'c'.repeat(48), prevToken: TOKEN_B, events: [], meds: [] }, 'good-C'), env());
    expect((await worker.fetch(new Request(`https://w.example/cal/${TOKEN_B}.ics`), env())).status).toBe(200);
  });
  it('geçersiz alanlar elenir (CRLF enjeksiyonu yok)', async () => {
    await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [{ ...ev, title: 'x\r\nBEGIN:VEVENT' }, { id: '../x', date: 'bad' }], meds: [] }), env());
    const txt = await (await worker.fetch(new Request(`https://w.example/cal/${TOKEN_A}.ics`), env())).text();
    expect(txt.split(/\r?\n/).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });
  it('CORS: yalnızca izinli kaynak', async () => {
    const ok = await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [], meds: [] }), env());
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://ok.example');
    const bad = await worker.fetch(post('/cal/sync', { token: TOKEN_A, events: [], meds: [] }, 'good-A', 'https://evil.example'), env());
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });
  it('AI: veri yoksa 400, günlük sınır 429, Gemini çağrısı anahtar başlığıyla', async () => {
    expect((await worker.fetch(post('/ai/weekly', { activities: [] }), env())).status).toBe(400);
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"yorum":"İyi gidiyor","oneriler":["a","b","c"]}' }] } }] }), { status: 200 });
    });
    const body = { activities: [{ name: 'İngilizce', weeklyTargetMin: 180, weeks: [60, 90, 120, 30] }] };
    const r = await worker.fetch(post('/ai/weekly', body), env());
    expect(await r.json()).toEqual({ text: 'İyi gidiyor', tips: ['a', 'b'] });
    expect(calls[0].init.headers['x-goog-api-key']).toBe('k');
    expect(calls[0].url).not.toContain('key=');
    for (let i = 0; i < 9; i++) await worker.fetch(post('/ai/weekly', body), env());
    expect((await worker.fetch(post('/ai/weekly', body), env())).status).toBe(429);
    vi.unstubAllGlobals();
  });
  it('AI günlük: değerlendirme + motivasyon döner, 401/400 kontrolü', async () => {
    expect((await worker.fetch(post('/ai/daily', {}, null), env())).status).toBe(401);
    expect((await worker.fetch(post('/ai/daily', { activities: [] }), env())).status).toBe(400);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"degerlendirme":"Güzel gün","motivasyon":"Küçük adımlar birikir"}' }] } }] }), { status: 200 }));
    const r = await worker.fetch(post('/ai/daily', { activities: [{ name: 'Spor', todayMin: 40, dailyTargetMin: 60, last7: [0, 30, 0, 45, 40, 0, 40] }], hour: 20, streak: 3 }), env());
    expect(await r.json()).toEqual({ text: 'Güzel gün', quote: 'Küçük adımlar birikir' });
    vi.unstubAllGlobals();
  });
});
