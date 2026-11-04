// Firebase ID token verification (RS256) with WebCrypto, using Google's public JWKs.
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));

let cache = { keys: null, at: 0 };
async function jwks() {
  if (cache.keys && Date.now() - cache.at < 3600_000) return cache.keys;
  const r = await fetch(JWK_URL, { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('jwk fetch failed');
  cache = { keys: (await r.json()).keys, at: Date.now() };
  return cache.keys;
}

// Returns the uid, or throws. `now` is injectable for tests.
export async function verifyIdToken(token, projectId, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const header = json(parts[0]);
  const claims = json(parts[1]);
  if (header.alg !== 'RS256') throw new Error('alg');
  const jwk = (await jwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('signature');
  const sec = now / 1000;
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('claims');
  if (!claims.sub || claims.exp < sec || claims.iat > sec + 300) throw new Error('expired');
  return claims.sub;
}
