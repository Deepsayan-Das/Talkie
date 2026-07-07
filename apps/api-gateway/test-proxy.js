const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');

const app = express();
app.use(express.json());

console.log('Starting test proxy on port 9998...');

app.use('/auth', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/': '/api/v1/auth/' },
    on: {
        proxyReq: (proxyReq, req) => {
            console.log('[proxyReq] forwarding to:', req.method, proxyReq.host + proxyReq.path);
        },
        proxyRes: (proxyRes, req) => {
            console.log('[proxyRes] got status:', proxyRes.statusCode, 'for', req.url);
        },
        error: (err, req, res) => {
            console.log('[error]', err.message);
            res.status(502).json({ error: err.message });
        }
    }
}));

app.listen(9998, () => console.log('Test proxy listening on 9998'));
