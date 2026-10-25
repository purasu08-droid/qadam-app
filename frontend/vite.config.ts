import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// В dev-режиме запросы /api уходят на бэкенд (backend/, порт из backend/.env, по умолчанию 3001).
const API_URL = process.env.API_URL ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
})
