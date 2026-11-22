import { defineConfig } from 'vite';

export default defineConfig({
  base: './',          // required for GitHub Pages sub-paths
  server: { host: true }
});
