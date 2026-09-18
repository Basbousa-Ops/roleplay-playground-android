import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // './' is required for Capacitor: the built files are loaded from
    // the local filesystem (file:// / https://localhost), not from '/'.
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
    },
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.APP_URL': JSON.stringify(process.env.APP_URL || 'https://ais-dev-pmfbofsmyhktrvoynd2leb-53020796844.europe-west2.run.app'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
