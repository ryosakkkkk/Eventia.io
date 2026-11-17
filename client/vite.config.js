import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Configuración PostCSS vacía: evita heredar archivos postcss.config de carpetas superiores
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
