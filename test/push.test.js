import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVapid, encryptPayload, b64u, unb64u, sendPush } from '../worker/src/webpush.js';
import { subscribe, setSchedule, runDue, validSub, sendTest } from '../worker/src/push.js';
import { eventItems, medItems, buildSchedule, localMs } from '../src/lib/push.js';

const enc = new TextEncoder();
const hkdf = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };

// A fake phone: its own ECDH key + auth secret, plus RFC 8291 decryption.
async function fakePhone(endpoint = 'https://web.push.apple.com/abc') {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint, keys: { p256dh: b64u(pub), auth: b64u(auth) } };
  const decrypt = async (body) => {
    const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, kp.privateKey, 256));
    const ikm = await hkdf(auth, ecdh, cat(enc.encode('WebPush: info\0'), pub, asPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
    return new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2)));
  };
  return { sub, decrypt };
}

const kv = () => { const m = new Map(); return { m, get: async (k, t) => { const v = m.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, put: async (k, v) => { m.set(k, v); } }; };

describe('Web Push şifreleme (RFC 8291)', () => {
  it('telefon, gönderilen mesajı çözebilir', async () => {
    const { sub, decrypt } = await fakePhone();
    const body = await encryptPayload(sub, JSON.stringify({ title: 'İlaç zamanı', body: 'Aslan · D vitamini' }));
    expect(JSON.parse(await decrypt(body))).toEqual({ title: 'İlaç zamanı', body: 'Aslan · D vitamini' });
  });
  it('VAPID imzası açık anahtarla doğrulanır', async () => {
    const vapid = await generateVapid();
    let sent;
    vi.stubGlobal('fetch', async (url, init) => { sent = { url, init }; return new Response(null, { status: 201 }); });
    const { sub } = await fakePhone();
    expect(await sendPush(vapid, sub, { title: 'x' }, { subject: 'https://example.test/' })).toBe(201);
    const auth = sent.init.headers.Authorization;
    const [, jwt, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(k).toBe(vapid.pub);
    const [h, c, s] = jwt.split('.');
    const pubKey = await crypto.subtle.importKey('raw', unb64u(vapid.pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64u(s), enc.encode(`${h}.${c}`))).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(unb64u(c))).aud).toBe('https://web.push.apple.com');
    expect(sent.init.headers['Content-Encoding']).toBe('aes128gcm');
    vi.unstubAllGlobals();
  });
});

describe('Worker push akışı', () => {
  let env;
  beforeEach(() => { env = { KV: kv() }; });

  it('yalnızca bilinen push servislerini kabul eder', async () => {
    const { sub } = await fakePhone();
    expect(validSub(sub)).toBe(true);
    expect(validSub({ ...sub, endpoint: 'https://evil.example/x' })).toBe(false);
    expect(validSub({ ...sub, endpoint: 'http://web.push.apple.com/x' })).toBe(false);
    expect(await subscribe(env, 'U', { ...sub, endpoint: 'https://169.254.169.254/' })).toBe(false);
  });
  it('zamanı gelen hatırlatmayı bir kez gönderir, geç kalmışı atlar', async () => {
    const { sub, decrypt } = await fakePhone();
    await subscribe(env, 'U', sub);
    const now = Date.now();
    await setSchedule(env, 'U', [
      { id: 'a', t: now - 60_000, title: 'Şimdi', body: 'b1' },
      { id: 'old', t: now - 3 * 3600_000, title: 'Eski', body: 'b2' },
      { id: 'future', t: now + 3600_000, title: 'Sonra', body: 'b3' },
    ]);
    const bodies = [];
    vi.stubGlobal('fetch', async (url, init) => { bodies.push(init.body); return new Response(null, { status: 201 }); });
    expect(await runDue(env, now)).toBe(1);
    expect(JSON.parse(await decrypt(bodies[0])).title).toBe('Şimdi');
    expect(await runDue(env, now + 1000)).toBe(0); // not twice
    expect(bodies).toHaveLength(1);
    vi.unstubAllGlobals();
  });
  it('plan yeniden gönderilince gönderilmiş kimlikler korunur; değişmeyen plan yazılmaz', async () => {
    const { sub } = await fakePhone();
    await subscribe(env, 'U', sub);
    const items = [{ id: 'a', t: Date.now() - 1000, title: 't', body: 'b' }];
    await setSchedule(env, 'U', items);
    vi.stubGlobal('fetch', async () => new Response(null, { status: 201 }));
    await runDue(env);
    expect((await setSchedule(env, 'U', items)).changed).toBe(false);
    expect(await runDue(env)).toBe(0);
    vi.unstubAllGlobals();
  });
  it('404/410 dönen abonelik silinir', async () => {
    const { sub } = await fakePhone();
    await subscribe(env, 'U', sub);
    vi.stubGlobal('fetch', async () => new Response(null, { status: 410 }));
    expect((await sendTest(env, 'U')).sent).toBe(0);
    expect(JSON.parse(env.KV.m.get('push:U')).subs).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

describe('İstemci: hatırlatma planı', () => {
  const T = '2026-11-05';
  it('saatli kayıt: 30 dk önce ve 1 gün önce', () => {
    const ev = [{ id: 'e1', scope: 'aile', title: 'Hastane', date: '2026-11-06', time: '10:30', repeat: 'none', remind: '30m' }];
    expect(eventItems(ev, T)[0].t).toBe(localMs('2026-11-06', '10:00'));
    const ev1d = [{ ...ev[0], remind: '1d' }];
    expect(eventItems(ev1d, T)[0].t).toBe(localMs('2026-11-06', '10:30') - 24 * 3600_000);
  });
  it('tüm gün kayıt: 1 gün önce 09:00; "zamanında" yok sayılır', () => {
    const ev = [{ id: 'e2', scope: 'aile', title: 'Doğum günü', date: '2026-11-07', time: null, repeat: 'none', remind: '1d' }];
    expect(eventItems(ev, T)[0].t).toBe(localMs('2026-11-06', '09:00'));
    expect(eventItems([{ ...ev[0], remind: 'at' }], T)).toEqual([]);
  });
  it('hatırlatması olmayan kayıt plana girmez', () => {
    expect(eventItems([{ id: 'x', scope: 'aile', title: 'x', date: T, time: '10:00', repeat: 'none', remind: 'none' }], T)).toEqual([]);
  });
  it('tekrarlayan kayıt birden çok gün üretir', () => {
    const ev = [{ id: 'w', scope: 'aile', title: 'Haftalık', date: '2026-11-05', time: '09:00', repeat: 'weekly', remind: 'at' }];
    expect(eventItems(ev, T, 14).length).toBeGreaterThanOrEqual(2);
  });
  it('ilaç: yalnızca istenen kişiler, işaretlenmiş dozlar hariç', () => {
    const meds = [
      { id: 'm1', forId: 'aslan', name: 'D vit', dose: '5 damla', meal: 'tok', times: ['09:00', '21:00'], startDate: T, endDate: '2026-11-06', archived: false },
      { id: 'm2', forId: 'B', name: 'Antibiyotik', dose: '1', meal: 'fark_etmez', times: ['08:00'], startDate: T, endDate: T, archived: false },
    ];
    const people = [{ id: 'A', name: 'Semihcan' }, { id: 'B', name: 'Eşi' }, { id: 'aslan', name: 'Aslan' }];
    const logs = [{ id: `m1_${T}_09:00`, medicationId: 'm1', date: T, time: '09:00', status: 'alindi' }];
    const out = medItems(meds, logs, people, new Set(['aslan']), T);
    expect(out.map((i) => i.id)).toEqual([`m-m1_${T}_21:00`, 'm-m1_2026-11-06_09:00', 'm-m1_2026-11-06_21:00']);
    expect(out[0].body).toBe('Aslan · D vit · 5 damla · tok karnına');
  });
  it('plan: geçmiş atılır, sıralanır, sınırlanır', () => {
    const now = 1_000_000_000_000;
    const out = buildSchedule([{ id: 'b', t: now + 5 }, { id: 'a', t: now + 1 }, { id: 'gone', t: now - 3 * 3600_000 }], now, 10);
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
  });
});
