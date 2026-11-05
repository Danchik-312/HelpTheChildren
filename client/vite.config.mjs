import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    {
      name: 'jsx-in-js',
      enforce: 'pre',
      async transform(code, id) {
        if (!/\/src\/.*\.js$/.test(id)) return null;
        return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
      },
    },
    {
      name: 'svg-react-component',
      enforce: 'pre',
      load(id) {
        if (!id.endsWith('.svg')) return null;
        // Keep CRA's named component import alongside Vite's default asset URL.
        return `export { default } from ${JSON.stringify(`${id}?url`)};\nexport { default as ReactComponent } from ${JSON.stringify(`${id}?react`)};`;
      },
    },
    svgr(),
    react(),
  ],
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    maxWorkers: 2,
  },
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
});
