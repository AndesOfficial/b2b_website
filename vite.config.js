import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('firebase/') || id.includes('@firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('react-icons/') || id.includes('recharts/') || id.includes('lucide-react/')) {
              return 'vendor-ui';
            }
            if (id.includes('jspdf') || id.includes('jszip')) {
              return 'vendor-utils';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increases the warning limit slightly
  }
})
