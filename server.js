// server.js — Production server for Render
// Serves the Vite build (dist/) and proxies /api/nisr/* → pxweb.statistics.gov.rw
// This avoids CORS errors when the browser calls NISR PXWeb directly.

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;

const app = express();

// ── Proxy: /api/nisr/* → https://pxweb.statistics.gov.rw
app.use(
  '/api/nisr',
  createProxyMiddleware({
    target: 'https://pxweb.statistics.gov.rw',
    changeOrigin: true,
    pathRewrite: { '^/api/nisr': '' },
    on: {
      error: (err, req, res) => {
        console.error('NISR proxy error:', err.message);
        res.status(502).json({ error: 'NISR API unreachable', detail: err.message });
      },
    },
  }),
);

// ── Proxy: /api/datagov/* → https://api.data.gov.rw
app.use(
  '/api/datagov',
  createProxyMiddleware({
    target: 'https://api.data.gov.rw',
    changeOrigin: true,
    pathRewrite: { '^/api/datagov': '' },
  }),
);

// ── Proxy: /api/mistral/* → https://api.mistral.ai
app.use(
  '/api/mistral',
  createProxyMiddleware({
    target: 'https://api.mistral.ai',
    changeOrigin: true,
    pathRewrite: { '^/api/mistral': '' },
  }),
);

// ── Serve Vite build (SPA — all routes → index.html)
app.use(express.static(join(__dirname, 'dist')));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Agrinsights server running on port ${PORT}`);
});
