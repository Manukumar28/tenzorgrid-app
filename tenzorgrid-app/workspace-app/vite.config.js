import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds straight into the shared public/ directory the plain-JS server already
// serves, so no server.js changes are needed — this is purely a frontend swap
// for the Virtual Workspace page.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: '../public',
    emptyOutDir: false,
    assetsDir: 'workspace-assets',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
