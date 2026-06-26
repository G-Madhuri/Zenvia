import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Only used in local dev
    proxy: {
      '/api': 'http://localhost:5000',
      '/video_feed': 'http://localhost:5000',
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})