import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    },
    setupFiles: ['./src/test/setup.ts'],
    deps: {
      optimizer: {
        web: {
          enabled: true,
          include: ['@phosphor-icons/react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
})
