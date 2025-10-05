import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// 개발 환경에서도 HTTPS 사용 (자체 서명 인증서)
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    https: true
  }
});
