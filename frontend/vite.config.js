import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// CCTV auth and camera management use PetCare backend; remaining CCTV APIs use port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      // PetCare backend (auth / จอง / คลินิก / หาบ้าน / รับส่ง / CCTV admin)
      '/api/cctv-auth': 'http://localhost:3001',
      '/api/cctv-admin': 'http://localhost:3001',
      '/api/pet-transport': 'http://localhost:3001',
      '/api/auth': 'http://localhost:3001',
      '/api/pet-owner': 'http://localhost:3001',
      '/api/clinic-admin': 'http://localhost:3001',
      '/api/adoption': 'http://localhost:3001',
      '/api/payments': 'http://localhost:3001',
      '/api/medical-assistant': 'http://localhost:3001',
      '/api/veterinarian': 'http://localhost:3001',
      '/api/super-admin': 'http://localhost:3001',
      // legacy CCTV stack (ถ้ามี)
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
  },
});
