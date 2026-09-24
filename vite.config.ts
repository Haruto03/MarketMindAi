import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The Gemini API key is only read by the Express server (server/index.ts);
// nothing secret is injected into the browser bundle here.
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
