import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// 개발 환경에서도 HTTPS 사용 (자체 서명 인증서)
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    // basicSsl() plugin enables HTTPS; explicit boolean can conflict with types
    proxy: {
      // Forward REST API to local signal server during dev
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // Forward WebSocket to local signal server during dev
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        changeOrigin: true
      }
    }
  },
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
  }
});
