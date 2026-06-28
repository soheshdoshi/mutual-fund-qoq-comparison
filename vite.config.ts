import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works on GitHub Pages (served under /<repo>/).
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
