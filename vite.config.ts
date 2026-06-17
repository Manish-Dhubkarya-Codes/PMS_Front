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
        target: 'https://api.cognicodeedutech.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      // Optional: Proxy API routes too
      '/api': {
        target: 'https://api.cognicodeedutech.com',
        changeOrigin: true,
        secure: false,
      },
     
      '/vapid-public-key': {
        target: 'https://api.cognicodeedutech.com',
        changeOrigin: true,
        secure: false,
      },
      // Add if needed for other routes (e.g., /images)
      '/images': {
        target: 'https://api.cognicodeedutech.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
