import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import paymentGatewayPlugin from './server/paymentGatewayPlugin.js';
import aiSearchPlugin from './server/aiSearchPlugin.js';
import coShoppingPlugin from './server/coShoppingPlugin.js';
import pricingPlugin from './server/pricingPlugin.js';
import returnsPlugin from './server/returnsPlugin.js';
import deliveryPlugin from './server/deliveryPlugin.js';
import comparePlugin from './server/comparePlugin.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      paymentGatewayPlugin(env),
      aiSearchPlugin(env),
      coShoppingPlugin(env),
      pricingPlugin(env),
      returnsPlugin(env),
      deliveryPlugin(env),
      comparePlugin(env)
    ],
    server: {
      port: 5173,
      host: true,
      open: true,
      allowedHosts: true,
    },
    preview: {
      port: 5173,
      host: true,
      allowedHosts: true,
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/@insforge/sdk')) {
              return 'vendor-insforge';
            }
          },
        },
      },
    },
  };
});
