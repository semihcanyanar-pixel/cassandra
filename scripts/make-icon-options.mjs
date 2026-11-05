// Three alternative app-icon outlines (replacing the heart line) for the Cassandra emblem. The glyphs (basket, calendar,
// toys + pacifier, heart + pill, "C") are cut out of the existing artwork (public/logo-mark.png) and kept unchanged.
// Output: design/icon-options/option-{1,2,3}.png (512 px) and overview.png
import sharp from 'sharp';
import fs from 'fs';

const MARK = 'public/logo-mark.png'; // 712 x 600, transparent, 2x of the crop that starts at (526,192) in the source
// glyph boxes inside logo-mark.png: [left, top, width, height]
const BOX = { basket: [168, 158, 128, 128], c: [270, 228, 176, 160], cal: [474, 146, 140, 128], toys: [180, 326, 116, 96], pill: [302, 408, 122, 96] };
// where each glyph goes on the 512 canvas: [centreX, centreY, height]
const POS = { c: [256, 256, 128], basket: [168, 168, 100], cal: [346, 168, 92], toys: [168, 348, 84], pill: [346, 346, 74] };

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d8da0"/><stop offset=".55" stop-color="#0a6a8a"/><stop offset="1" stop-color="#083a60"/></linearGradient>
  <radialGradient id="gl" cx=".5" cy=".38" r=".6"><stop offset="0" stop-color="#2fb7c4" stop-opacity=".35"/><stop offset="1" stop-color="#2fb7c4" stop-opacity="0"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#gl)"/></svg>`;

const copper = `<linearGradient id="cu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8b08c"/><stop offset=".5" stop-color="#c47f5b"/><stop offset="1" stop-color="#9c5a3e"/></linearGradient>`;
const node = (x, y) => `<g><circle cx="${x}" cy="${y}" r="21" fill="url(#cu)"/><circle cx="${x}" cy="${y}" r="13" fill="#5d4545"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#f0c8a8" stroke-opacity=".5" stroke-width="2"/></g>`;
const ring = (shape) => `${shape.replace('/>', ' fill="none" stroke="url(#cu)" stroke-width="13"/>')}${shape.replace('/>', ' fill="none" stroke="#f5d2b4" stroke-opacity=".55" stroke-width="3"/>')}`;
// thin spokes from the C to the glyphs, as in the original network look
const spokes = Object.entries(POS).filter(([k]) => k !== 'c').map(([, [x, y]]) => `<line x1="256" y1="256" x2="${x}" y2="${y}" stroke="#d9a07f" stroke-opacity=".55" stroke-width="3"/>`).join('');
const frame = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs>${copper}</defs>${inner}</svg>`;

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const ringNodes = (r, degs) => degs.map((d) => node(...polar(256, 256, r, d).map(Math.round))).join('');

const options = {
  // 1: two ellipses crossing (one wide, one tall), nodes where they cross and at the tips
  1: frame(`${ring('<ellipse cx="256" cy="256" rx="222" ry="150"/>')}${ring('<ellipse cx="256" cy="256" rx="150" ry="222"/>')}${spokes}
    ${[[133, 133], [379, 133], [133, 379], [379, 379], [256, 34], [256, 478], [34, 256], [478, 256]].map(([x, y]) => node(x, y)).join('')}`),
  // 2: a single circle with six nodes
  2: frame(`${ring('<circle cx="256" cy="256" r="222"/>')}${spokes}${ringNodes(222, [-90, -30, 30, 90, 150, 210])}`),
  // 3: a globe: circle + meridians + parallels (thin, behind the glyphs)
  3: frame(`${ring('<circle cx="256" cy="256" r="222"/>')}
    <g fill="none" stroke="#d9a07f" stroke-opacity=".6" stroke-width="3.5">
      <ellipse cx="256" cy="256" rx="110" ry="222"/><line x1="256" y1="34" x2="256" y2="478"/>
      <ellipse cx="256" cy="256" rx="222" ry="95"/><line x1="34" y1="256" x2="478" y2="256"/>
      <path d="M62 150 Q256 205 450 150"/><path d="M62 362 Q256 307 450 362"/></g>
    ${ringNodes(222, [-90, -30, 30, 90, 150, 210])}`),
};

const glyph = async (name) => {
  const [l, t, w, h] = BOX[name];
  const [cx, cy, th] = POS[name];
  const buf = await sharp(MARK).extract({ left: l, top: t, width: w, height: h }).resize({ height: th }).toBuffer({ resolveWithObject: true });
  return { input: buf.data, left: Math.round(cx - buf.info.width / 2), top: Math.round(cy - buf.info.height / 2) };
};
const glyphs = await Promise.all(Object.keys(POS).map(glyph));
// a soft dark disc behind each glyph keeps it readable above any line
const backing = Object.values(POS).map(([x, y, h]) => `<circle cx="${x}" cy="${y}" r="${Math.round(h * 0.6)}" fill="#0a5a78" fill-opacity=".6"/>`).join('');
const backingSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${backing}</svg>`);

fs.mkdirSync('design/icon-options', { recursive: true });
const files = [];
for (const [k, svg] of Object.entries(options)) {
  const out = `design/icon-options/option-${k}.png`;
  await sharp(Buffer.from(bg)).composite([{ input: Buffer.from(svg) }, { input: backingSvg }, ...glyphs]).png().toFile(out);
  files.push(out);
}
// overview: the three options side by side, plus how each looks at home-screen size
const tiles = await Promise.all(files.map((f) => sharp(f).resize(300, 300).png().toBuffer()));
const small = await Promise.all(files.map((f) => sharp(f).resize(90, 90).png().toBuffer()));
await sharp({ create: { width: 960, height: 440, channels: 3, background: '#e8ecf3' } })
  .composite([
    ...tiles.map((b, i) => ({ input: b, left: 20 + i * 315, top: 20 })),
    ...small.map((b, i) => ({ input: b, left: 125 + i * 315, top: 335 })),
  ]).png().toFile('design/icon-options/overview.png');
console.log('done');
