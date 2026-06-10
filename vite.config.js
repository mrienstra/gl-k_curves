import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const base = '/gl-k_curves/';

  // `npm run build:render-path` — GL-k path format renderer
  if (mode === 'render-path-lib') {
    return {
      base,
      build: {
        emptyOutDir: false,
        lib: {
          entry:    resolve(__dirname, 'glk-render-path.ts'),
          formats:  ['es'],
          fileName: () => 'glk-render-path.js',
        },
        rollupOptions: {
          external: ['svg-path-simplify'],
        },
      },
    };
  }

  // `npm run build:render` — JSON format renderer
  if (mode === 'render-lib') {
    return {
      base,
      build: {
        emptyOutDir: false,
        lib: {
          entry:    resolve(__dirname, 'glk-render.ts'),
          formats:  ['es'],
          fileName: () => 'glk-render.js',
        },
        rollupOptions: {
          // svg-path-simplify is ~163 KB and is never called by render()
          // (it's only reachable via buildSVG's `simplify` option which we
          // never pass).  Exclude it from the standalone bundle.
          external: ['svg-path-simplify'],
        },
      },
    };
  }

  // default: multi-page app
  return {
    base,
    build: {
      rollupOptions: {
        input: {
          editor: resolve(__dirname, 'editor.html'),
          basis:  resolve(__dirname, 'basis.html'),
        },
      },
    },
  };
});
