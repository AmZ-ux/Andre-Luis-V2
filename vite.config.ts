import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],

  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react')) return 'ui'
          if (id.includes('node_modules/recharts')) return 'charts'
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
}))
