import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../worker/src/jwt.js', () => ({
  verifyIdToken: async (t) => { if (!t.startsWith('good-')) throw new Error('bad'); return t.slice(5); },
}));
const worker = (await import('../worker/src/index.js')).default;
const { sniff } = await import('../worker/src/files.js');

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 1, 2, 3]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);

let store, meta;
const env = () => ({
  FIREBASE_PROJECT_ID: 'p', HOUSEHOLD_ID: 'h1', ALLOWED_ORIGINS: 'https://ok.example',
  KV: {
    get: async (k) => store.get(k) ?? null,
    put: async (k, v, o) => { store.set(k, v); if (o?.metadata) meta.set(k, o.metadata); },
    delete: async (k) => { store.delete(k); meta.delete(k); },
    getWithMetadata: async (k) => ({ value: store.get(k) ?? null, metadata: meta.get(k) ?? null }),
  },
});
// A and B are household members; C is not.
const firestore = vi.fn(async (url, init) => new Response('{}', { status: /Bearer good-[AB]$/.test(init?.headers?.Authorization || '') ? 200 : 403 }));

const up = (bytes, { scope = 'personal', auth = 'good-A', name = 'foto.jpg' } = {}) => new Request('https://w.example/files', {
  method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'X-Scope': scope, 'X-Name': encodeURIComponent(name), Origin: 'https://ok.example', 'Content-Type': 'application/octet-stream' }, body: bytes,
});
const get = (id, auth = 'good-A') => new Request(`https://w.example/files/${id}`, { headers: { Authorization: `Bearer ${auth}`, Origin: 'https://ok.example' } });
const del = (id, auth = 'good-A') => new Request(`https://w.example/files/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth}`, Origin: 'https://ok.example' } });

beforeEach(() => { store = new Map(); meta = new Map(); vi.stubGlobal('fetch', firestore); });

describe('dosya türü kontrolü', () => {
  it('ilk baytlardan gerçek türü bulur', () => {
    expect(sniff(JPG.buffer)).toBe('image/jpeg');
    expect(sniff(PDF.buffer)).toBe('application/pdf');
    expect(sniff(EXE.buffer)).toBeNull();
  });
});

describe('not ekleri (Worker)', () => {
  it('girişsiz istek 401', async () => {
    expect((await worker.fetch(up(JPG, { auth: 'evil' }), env())).status).toBe(401);
  });
  it('geçerli resim ve PDF yüklenir; geçersiz tür (exe) reddedilir', async () => {
    const r = await worker.fetch(up(JPG), env());
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ name: 'foto.jpg', type: 'image/jpeg', size: JPG.length });
    expect(j.id).toMatch(/^[0-9a-f]{32}$/);
    expect((await worker.fetch(up(PDF, { name: 'rapor.pdf' }), env())).status).toBe(200);
    expect((await worker.fetch(up(EXE, { name: 'x.pdf' }), env())).status).toBe(415);
  });
  it('20 MB üstü reddedilir', async () => {
    const big = new Request('https://w.example/files', { method: 'POST', headers: { Authorization: 'Bearer good-A', 'Content-Length': String(21 * 1024 * 1024), 'X-Scope': 'personal' }, body: JPG });
    expect((await worker.fetch(big, env())).status).toBe(413);
  });
  it('kişisel dosyayı yalnızca yükleyen açar ve siler', async () => {
    const { id } = await (await worker.fetch(up(JPG), env())).json();
    const mine = await worker.fetch(get(id), env());
    expect(mine.status).toBe(200);
    expect(mine.headers.get('Content-Type')).toBe('image/jpeg');
    expect(mine.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await worker.fetch(get(id, 'good-B'), env())).status).toBe(403); // even the partner cannot
    expect((await worker.fetch(del(id, 'good-B'), env())).status).toBe(403);
    expect((await worker.fetch(del(id), env())).status).toBe(200);
    expect((await worker.fetch(get(id), env())).status).toBe(404);
  });
  it('aile dosyasını iki üye açar, üye olmayan açamaz ve yükleyemez', async () => {
    const { id } = await (await worker.fetch(up(PDF, { scope: 'family', name: 'sigorta.pdf' }), env())).json();
    expect((await worker.fetch(get(id, 'good-B'), env())).status).toBe(200);
    expect((await worker.fetch(get(id, 'good-C'), env())).status).toBe(403);
    expect((await worker.fetch(del(id, 'good-C'), env())).status).toBe(403);
    expect((await worker.fetch(up(PDF, { scope: 'family', auth: 'good-C' }), env())).status).toBe(403);
  });
  it('olmayan ya da bozuk kimlik 404', async () => {
    expect((await worker.fetch(get('a'.repeat(32)), env())).status).toBe(404);
    expect((await worker.fetch(get('../x'), env())).status).toBe(404);
  });
  it('dosya adındaki satır sonları temizlenir', async () => {
    const r = await worker.fetch(up(JPG, { name: 'a\r\nb.jpg' }), env());
    expect((await r.json()).name).toBe('a  b.jpg');
  });
});
