import sharp from 'sharp';
// App icon = the user's logo artwork (design/logo-source.jpg) WITHOUT the caption text.
// The tile sits at x 499..909, y 165..602 of the 1408x768 source; the heart artwork ends at about y 492, the caption starts at ~499.
// Crop inside the tile (rounded-corner background never shows; iOS applies its own mask) down to y 492, then
// edge-extend top and bottom so the artwork is centred on a square.
const X = 499 + 27, Y = 165 + 27, W = 410 - 54, H = 492 - Y;
const pad = Math.floor((W - H) / 2);
for (const [name, s] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  const base = await sharp('design/logo-source.jpg').extract({ left: X, top: Y, width: W, height: H })
    .extend({ top: pad, bottom: W - H - pad, extendWith: 'copy' }).toBuffer();
  await sharp(base).resize(s, s).png().toFile(`public/${name}.png`);
}
