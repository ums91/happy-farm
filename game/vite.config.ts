import { defineConfig } from 'vite';

export default defineConfig({
  base: '/happy-farm/',
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
});
