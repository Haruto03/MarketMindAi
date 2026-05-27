import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR always ON — auto-detect and reload on every file change
      hmr: true,
      watch: {
        // usePolling is a fallback for environments where native FS events
        // don't fire (e.g. WSL, Docker volumes, network drives).
        // Set to false if you're on a native Windows/macOS filesystem.
        usePolling: false,
        interval: 100,
      },
    },
  };
});
