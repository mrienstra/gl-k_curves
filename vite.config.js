import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/gl-k_curves/',
  build: {
    rollupOptions: {
      input: {
        editor: resolve(__dirname, 'editor.html'),
        basis:  resolve(__dirname, 'basis.html'),
      },
    },
  },
});
