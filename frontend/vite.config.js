import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Super Admin = Pet Hotel CCTV — proxy API to hotel-cctv backend (port 3000).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
  },
});
