// Globe emblem: replaces the heart outline with a globe (circle + meridians + parallels + copper nodes).
// The glyphs (basket, calendar, toys + pacifier, heart + pill, "C") are cut from the ORIGINAL heart emblem (design/logo-mark-heart.png) unchanged.
// Writes public/icon-192.png, icon-512.png, apple-touch-icon.png (with the teal background) and public/logo-mark.png (transparent, used by the splash).
import sharp from 'sharp';

const MARK = 'design/logo-mark-heart.png'; // 712 x 600, transparent
const BOX = { basket: [168, 158, 128, 128], c: [270, 228, 176, 160], cal: [474, 146, 140, 128], toys: [180, 326, 116, 96], pill: [302, 408, 122, 96] };
const POS = { c: [256, 256, 128], basket: [168, 168, 100], cal: [346, 168, 92], toys: [168, 348, 84], pill: [346, 346, 74] };

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c97a6"/><stop offset=".5" stop-color="#00708a"/><stop offset="1" stop-color="#052f45"/></linearGradient>
  <radialGradient id="gl" cx=".5" cy=".38" r=".6"><stop offset="0" stop-color="#2fb7c4" stop-opacity=".3"/><stop offset="1" stop-color="#2fb7c4" stop-opacity="0"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#gl)"/></svg>`;
const copper = `<linearGradient id="cu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8b08c"/><stop offset=".5" stop-color="#c47f5b"/><stop offset="1" stop-color="#9c5a3e"/></linearGradient>`;
const node = (x, y) => `<circle cx="${x}" cy="${y}" r="21" fill="url(#cu)"/><circle cx="${x}" cy="${y}" r="13" fill="#5d4545"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#f0c8a8" stroke-opacity=".5" stroke-width="2"/>`;
const ring = (shape) => `${shape.replace('/>', ' fill="none" stroke="url(#cu)" stroke-width="13"/>')}${shape.replace('/>', ' fill="none" stroke="#f5d2b4" stroke-opacity=".55" stroke-width="3"/>')}`;
const polar = (r, deg) => [256 + r * Math.cos((deg * Math.PI) / 180), 256 + r * Math.sin((deg * Math.PI) / 180)].map(Math.round);
const globe = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs>${copper}</defs>
  ${ring('<circle cx="256" cy="256" r="222"/>')}
  <g fill="none" stroke="#d9a07f" stroke-opacity=".6" stroke-width="3.5">
    <ellipse cx="256" cy="256" rx="110" ry="222"/><line x1="256" y1="34" x2="256" y2="478"/>
    <ellipse cx="256" cy="256" rx="222" ry="95"/><line x1="34" y1="256" x2="478" y2="256"/>
    <path d="M62 150 Q256 205 450 150"/><path d="M62 362 Q256 307 450 362"/></g>
  ${[-90, -30, 30, 90, 150, 210].map((d) => node(...polar(222, d))).join('')}</svg>`;
const backing = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${Object.values(POS).map(([x, y, h]) => `<circle cx="${x}" cy="${y}" r="${Math.round(h * 0.6)}" fill="#0a5a78" fill-opacity=".6"/>`).join('')}</svg>`;

// Each glyph is cut with a soft elliptical mask so no scraps of the old heart outline or nodes remain at the box corners.
const glyph = async (name) => {
  const [l, t, w, h] = BOX[name];
  const [cx, cy, th] = POS[name];
  const base = await sharp(MARK).extract({ left: l, top: t, width: w, height: h }).resize({ height: th }).toBuffer({ resolveWithObject: true });
  const { width: gw, height: gh } = base.info;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${gw}" height="${gh}"><defs><radialGradient id="m" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${gw}" height="${gh}" fill="url(#m)"/></svg>`);
  const masked = await sharp(base.data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { input: masked, left: Math.round(cx - gw / 2), top: Math.round(cy - gh / 2) };
};
const glyphs = await Promise.all(Object.keys(POS).map(glyph));
const layers = [{ input: Buffer.from(globe) }, { input: Buffer.from(backing) }, ...glyphs];

// 1. icons with the teal background
const icon = await sharp(Buffer.from(bg)).composite(layers).png().toBuffer();
for (const [name, s] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) await sharp(icon).resize(s, s).png().toFile(`public/${name}.png`);
// 2. transparent emblem for the splash / login screen
await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile('public/logo-mark.png');
console.log('icons + logo-mark written');
