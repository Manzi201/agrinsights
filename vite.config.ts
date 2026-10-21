import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Proxy for NISR PXWeb API (https://pxweb.statistics.gov.rw:443)
      '/api/nisr': {
        target: 'https://pxweb.statistics.gov.rw:443',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/nisr/, ''),
      },
      // Proxy for data.gov.rw API
      '/api/datagov': {
        target: 'https://api.data.gov.rw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/datagov/, ''),
      },
      // Proxy for Mistral AI API (avoids CORS issues in dev)
      '/api/mistral': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mistral/, ''),
      },
    },
  },
});
