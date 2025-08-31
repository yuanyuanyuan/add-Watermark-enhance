import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/engines': resolve(__dirname, './src/engines'),
      '@/workers': resolve(__dirname, './src/workers'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/constants': resolve(__dirname, './src/constants'),
    },
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@/workers/*']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'canvas-engine': ['./src/engines/canvas/CanvasRenderer.ts'],
          'worker-pool': ['./src/workers/WorkerPool.ts']
        }
      }
    }
  }
})