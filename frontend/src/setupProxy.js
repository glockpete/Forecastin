/**
 * Create React App Development Proxy Configuration
 * 
 * CRITICAL: This file configures http-proxy-middleware to route WebSocket connections
 * from the frontend dev server (port 3000) to the backend API (port 9001)
 * 
 * WHY THIS IS NEEDED:
 * - Frontend dev server runs on port 3000
 * - Backend API runs on port 9001
 * - WebSocket connections from browser must go to port 9001, not 3000
 * - This proxy handles the routing transparently
 * 
 * AGENT RULES CONTEXT:
 * - WebSocket serialization requires orjson on backend
 * - Implement exponential backoff with jitter for reconnections
 * - Add ping/pong keepalive every 20 seconds
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy WebSocket connections to backend
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:9001',
      ws: true, // Enable WebSocket proxying
      changeOrigin: true,
      logLevel: 'debug',
      
      // WebSocket-specific configuration
      onProxyReqWs: (proxyReq, req, socket) => {
        console.log('[PROXY] WebSocket connection initiated:', req.url);
        
        // Add keepalive to prevent connection drops
        socket.setKeepAlive(true, 20000); // 20 second keepalive
      },
      
      onOpen: (proxySocket) => {
        console.log('[PROXY] WebSocket connection opened');
      },
      
      onClose: (res, socket, head) => {
        console.log('[PROXY] WebSocket connection closed');
      },
      
      onError: (err, req, res) => {
        console.error('[PROXY] WebSocket proxy error:', err);
      }
    })
  );

  // Proxy HTTP API requests to backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:9001',
      changeOrigin: true,
      logLevel: 'debug',
      
      onProxyReq: (proxyReq, req, res) => {
        console.log('[PROXY] API request:', req.method, req.url);
      },
      
      onError: (err, req, res) => {
        console.error('[PROXY] API proxy error:', err);
        res.status(500).json({ error: 'Proxy error', details: err.message });
      }
    })
  );
};