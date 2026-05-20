import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
