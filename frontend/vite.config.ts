import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all addresses
    strictPort: true,

    // Proxy configuration (replaces setupProxy.js)
    proxy: {
      // WebSocket proxy
      '/ws': {
        target: process.env.VITE_API_URL || 'http://localhost:9000',
        ws: true, // Enable WebSocket proxy
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('WebSocket proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('WebSocket proxying:', req.method, req.url);
          });
        },
      },

      // API proxy
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:9000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('API proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('API proxying:', req.method, req.url);
          });
        },
      },
    },
  },

  // Path aliases (matching tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './src/types'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@config': path.resolve(__dirname, './src/config'),
      '@layers': path.resolve(__dirname, './src/layers'),
      '@handlers': path.resolve(__dirname, './src/handlers'),
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,

    // Target modern browsers
    target: 'es2015',

    // Asset optimization
    assetsInlineLimit: 4096, // 4kb

    // Chunk splitting strategy
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'map-vendor': ['maplibre-gl', 'deck.gl'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
        },
      },
    },

    // Performance optimizations
    minify: 'esbuild',
    cssMinify: true,

    // Increase chunk size warning limit (deck.gl is large)
    chunkSizeWarningLimit: 1000,
  },

  // Environment variable handling
  envPrefix: 'VITE_',

  // Optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'maplibre-gl',
      'deck.gl',
    ],
    exclude: ['@mapbox/node-pre-gyp'],
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },

  // Enable esbuild for fast builds
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
})
