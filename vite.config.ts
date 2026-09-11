import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // The app shipped as one 2.26 MB chunk and this limit had been raised to
      // 3500 to keep the warning quiet. It is back at a level where a regression
      // is visible; the vendor libraries below are split out so they cache
      // across deploys instead of being re-downloaded with every change to
      // the app's own code.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) return 'react';
            // The protobuf decoder is only needed once a GTFS-RT feed is read;
            // it is imported dynamically, so this keeps it in its own chunk.
            if (id.includes('node_modules/gtfs-realtime-bindings') || id.includes('node_modules/protobufjs') || id.includes('node_modules/long')) return 'gtfs-rt';
            return undefined;
          },
        },
      },
    },
    // MapLibre starts its worker with `new Worker(url, { type: 'module' })`, so
    // the worker bundle Vite emits has to be an ES module too.
    worker: {
      format: 'es' as const,
    },
    optimizeDeps: {
      exclude: ['maplibre-gl']
    }
  };
});
