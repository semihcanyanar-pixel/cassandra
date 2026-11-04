import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base: works on GitHub Pages under /<repo>/ without extra config.
export default defineConfig({
  base: './',
  plugins: [preact()],
  test: { environment: 'node' },
});
