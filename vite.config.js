import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-ui': ['react-icons', 'recharts', 'lucide-react'],
          'vendor-utils': ['jspdf', 'jspdf-autotable', 'exceljs', 'jszip']
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increases the warning limit slightly
  }
})
