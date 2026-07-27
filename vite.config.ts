import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'


 const url = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss(),],

  
  server: {
    port: 5173,
    proxy: {
      // Proxy Socket.io (critical for WS upgrades)
      '/socket.io': {
        target: url,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      // Optional: Proxy API routes too
      '/api': {
        target: url,
        changeOrigin: true,
        secure: false,
      },
     
      '/vapid-public-key': {
        target: url,
        changeOrigin: true,
        secure: false,
      },
      // Add if needed for other routes (e.g., /images)
      '/images': {
        target: url,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
