import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CCTV auth and camera management use PetCare backend; remaining CCTV APIs use port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      '/api/cctv-auth': 'http://localhost:3001',
      '/api/cctv-admin': 'http://localhost:3001',
      '/api/pet-transport': 'http://localhost:3001',
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
  },
});
