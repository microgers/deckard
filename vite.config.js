import { defineConfig } from 'vite';

// GitHub Pages users: set base to '/<repo-name>/'.
// Vercel, Netlify, Firebase Hosting and custom domains all use '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: { target: 'es2020', outDir: 'dist', sourcemap: true }
});
