import { defineConfig } from 'vite';

export default defineConfig({
  // Preview server config (used by `npm run start` on Render)
  preview: {
    port: 10000,
    host: '0.0.0.0',
    allowedHosts: true,
  },

  // Dev server config (local development only)
  server: {
    port: 5173,
    proxy: {
      // NISR PXWeb API proxy
      '/api/nisr': {
        target: 'https://pxweb.statistics.gov.rw:443',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/nisr/, ''),
      },
      // data.gov.rw API proxy
      '/api/datagov': {
        target: 'https://api.data.gov.rw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/datagov/, ''),
      },
      // Mistral AI API proxy
      '/api/mistral': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mistral/, ''),
      },
    },
  },
});
