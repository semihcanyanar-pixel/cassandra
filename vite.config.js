import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base: works on GitHub Pages under /<repo>/ without extra config.
export default defineConfig({
  base: './',
  plugins: [preact()],
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) }, // shown in Ayarlar so the running version can be told apart
  test: { environment: 'node' },
});
