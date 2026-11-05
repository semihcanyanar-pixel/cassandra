// Cuts the heart emblem out of the logo (design/logo-source.jpg) with a transparent background -> public/logo-mark.png.
// The tile background is teal (almost no red) while the emblem is bronze/cream/brown (lots of red), so the red channel
// gives a clean opacity that also ignores the soft light glow in the tile background.
import sharp from 'sharp';

const X = 499 + 27, Y = 165 + 27, W = 410 - 54, H = 492 - Y; // same crop as the app icon, without the caption
const { data } = await sharp('design/logo-source.jpg').extract({ left: X, top: Y, width: W, height: H }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const out = Buffer.alloc(W * H * 4);
const LO = 30, HI = 85;
for (let p = 0; p < W * H; p++) {
  const i = p * 3, o = p * 4;
  const t = Math.min(1, Math.max(0, (data[i] - LO) / (HI - LO)));
  out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2];
  out[o + 3] = Math.round(t * t * (3 - 2 * t) * 255); // smoothstep
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).resize(W * 2, H * 2, { kernel: 'lanczos3' }).png().toFile('public/logo-mark.png');
console.log('public/logo-mark.png', W * 2, 'x', H * 2);
