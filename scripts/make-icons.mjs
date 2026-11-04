import sharp from 'sharp';
// App icon = the user's logo (design/logo-source.jpg). The tile sits at x 499..909, y 165..602 of the 1408x768 source.
// Crop slightly inside it (so the rounded-corner background never shows; iOS applies its own mask), then edge-extend
// the short side to make it square without distorting the artwork.
const INSET = 27;
const crop = { left: 499 + INSET, top: 165 + INSET, width: 410 - 2 * INSET, height: 437 - 2 * INSET };
const pad = Math.round((crop.height - crop.width) / 2);
for (const [name, s] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  const base = await sharp('design/logo-source.jpg').extract(crop).extend({ left: pad, right: crop.height - crop.width - pad, extendWith: 'copy' }).toBuffer();
  await sharp(base).resize(s, s).png().toFile(`public/${name}.png`);
}
