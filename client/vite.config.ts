import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react(), basicSsl()],
  optimizeDeps: {
    include: ['@react-oauth/google', 'jwt-decode']
  },
  server: {
    host: true,
    // Dynamic COOP/COEP headers based on auth cookie presence (Option B)
    // GREYFALLID present → apply cross-origin isolation; otherwise relax for Google Sign-In
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const cookie = req.headers['cookie'] || '';
          const hasSession = typeof cookie === 'string' && /(?:^|;\s*)GREYFALLID=/.test(cookie);
          res.setHeader('Vary', 'Cookie');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Cross-Origin-Opener-Policy', hasSession ? 'same-origin' : 'same-origin-allow-popups');
          if (hasSession) {
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          } else {
            // Clear COEP when unauthenticated to allow GSI popup/redirect messaging
            if ('removeHeader' in res) {
              // @ts-expect-error Node ServerResponse
              res.removeHeader('Cross-Origin-Embedder-Policy');
            } else {
              res.setHeader('Cross-Origin-Embedder-Policy', '');
            }
          }
        } catch {}
        next();
      });
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
      // Logs dashboard under /dashboard → logs server
      '/dashboard': {
        target: 'http://localhost:8080',
        changeOrigin: true
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
    preserveSymlinks: true,
    alias: {
      '@app': path.resolve(__dirname, 'src'),
      '@shared/protocol': path.resolve(__dirname, '../shared/protocol/schema.ts')
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
