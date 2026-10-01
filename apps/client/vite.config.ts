import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 8081,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/getBlocks': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/getPatients': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/getDoctors': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/getReports': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/downloadFile': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/patientdatas': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/doctordatas': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/reportdatas': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/registerPatient': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/registerDoctor': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
