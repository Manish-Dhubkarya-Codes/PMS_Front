import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react(), tailwindcss(),],
  
  server: {
    port: 5173,
    proxy: {
      // Proxy Socket.io (critical for WS upgrades)
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      // Optional: Proxy API routes too
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
     
      '/vapid-public-key': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // Add if needed for other routes (e.g., /images)
      '/images': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
