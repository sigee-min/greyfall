import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff'
    },
    // no need to allow parent now that files are inside client/
    proxy: {
      // Signal server REST endpoints (register before generic /api)
      '/api/sessions': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\//, '/')
      },
      '/api/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\//, '/')
      },
      // Logs API (ingest/dashboard)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      // Logs dashboard under /server/dashboard → logs server (/dashboard)
      '/server/dashboard': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/server\/dashboard/, '/dashboard')
      },
      // Signal WebSocket gateway
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@greyfall/protocol': path.resolve(__dirname, '../protocol/src/schema.ts'),
      'zod': path.resolve(__dirname, 'node_modules/zod'),
      '@app': path.resolve(__dirname, 'src')
    }
  },
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-mlc': ['@mlc-ai/web-llm'],
          'vendor-pixi': ['pixi.js', '@pixi/filter-kawase-blur', '@pixi/filter-noise', '@pixi/layers']
        }
      }
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff'
    }
  }
});
