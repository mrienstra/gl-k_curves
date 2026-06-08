import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        editor: resolve(__dirname, 'editor.html'),
        basis:  resolve(__dirname, 'basis.html'),
      },
    },
  },
});
