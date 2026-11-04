import sharp from 'sharp';
// Simple placeholder icon: rounded dark tile with a yellow "C" ring.
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#121212"/>
<path d="M352 168a132 132 0 1 0 0 176" fill="none" stroke="#FFD43B" stroke-width="56" stroke-linecap="round"/></svg>`;
for (const [name, s] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  await sharp(Buffer.from(svg(s))).png().toFile(`public/${name}.png`);
}
