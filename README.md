# GL-k curves

TypeScript implementation of GL-k curves from:

> Ramanantoanina & Hormann, "GL-k Curves", *Computer Aided Geometric Design* 127, 2026

GL-k curves are a family of spline-like curves defined by control points, parameterised by an order *k*.  At *k*=1 they behave similarly to cubic B-splines; higher *k* gives a smoother curve that stays closer to the control polygon.  A *modified* variant (Section 6 of the paper) adds a tangent correction at the endpoints.

**[Live demo →](https://mrienstra.github.io/gl-k_curves/editor.html)**

---

## Interactive tools

```
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

| Page | Purpose |
|------|---------|
| [`editor.html`](editor.html) | Interactive canvas editor — place control points, compare GL-0/1/2, modified GL-1, fractional k |
| [`basis.html`](basis.html) | GL-k basis function plotter |

The editor's **Copy** button copies the current curve to the clipboard as JSON.  **Paste** loads JSON or an SVG file.  The **SVG** button exports the rendered curves.

---

## Standalone renderers

Two small ES-module libraries for rendering GL-k curves to SVG without the editor.

### JSON format — `glk-render.ts`

Accepts the editor's native JSON format: either a raw array of segments or the
object form with metadata.

```ts
import { render } from './glk-render';

// Simple: array of segments, each an array of [x, y] control points
const svg = render([[[0,0],[100,50],[200,100],[300,0]]]);

// With options
const svg = render(myJson, { stroke: '#1a1a1a', strokeWidth: 1.5, padding: 20 });

// Object form (e.g. copied from editor)
const svg = render({ segments: [...], eta: null });
```

Options: `stroke`, `strokeWidth`, `padding`, `eta`, `background`.

Build: `npm run build:render` → `dist/glk-render.js` + `dist/glk-render.min.js`

### GL-k path format — `glk-render-path.ts`

Accepts a `<glk:path>` element — a proposed SVG-native syntax for GL-k curves
(see [`glk-path-format.md`](glk-path-format.md)).  Control points are encoded
as SVG `M`/`L` path commands; style and curve parameters are element attributes.

```ts
import { renderGLKPath, parsePath } from './glk-render-path';

// From an element string
const svg = renderGLKPath(
  '<glk:path k="1" modified="true" stroke="#333" stroke-width="2" d="M 0,0 100,50 200,100 300,0"/>'
);

// From an attribute object
const svg = renderGLKPath({ d: 'M 0,0 100,50 200,100 300,0', stroke: '#333' });

// Just parse the path data
const { segments, closedSet } = parsePath('M 0,0 100,50 200,0 Z');
```

Attributes: `d`, `k` (default 1), `modified` (default true), `eta`, `alpha`, `stroke`, `stroke-width`.

Build: `npm run build:render-path` → `dist/glk-render-path.js` + `dist/glk-render-path.min.js`

#### Path format quick reference

```xml
<!-- Open curve: M starts, subsequent pairs are implicit lineto -->
<glk:path k="1" modified="true" stroke="#333" stroke-width="2"
  d="M 100,200 150,50 250,80 300,200"/>

<!-- Closed curve -->
<glk:path d="M 100,200 150,50 250,80 300,200 Z"/>

<!-- Sharp corner: mid-path M with repeated coordinate -->
<glk:path d="M 100,200 150,50 200,100
             M 200,100 250,150 300,200"/>
```

See [`glk-path-format.md`](glk-path-format.md) for the full design rationale.

### Bundle sizes (gzip)

| | raw | gzip |
|---|---|---|
| `glk-render.min.js` | 11.2 kB | 4.7 kB |
| `glk-render-path.min.js` | 12.6 kB | 5.2 kB |

The renderer overhead amortises quickly: at ~5 curves per page, the renderer
approach (compact GL-k data + one renderer script) becomes smaller than
shipping pre-compiled SVG files.

---

## Input/output format

The editor saves curves as JSON.  The minimal format is a nested array:

```json
[
  [[348,803],[329,787],[271,789],[167,838]],
  [[184,36],[172,57],[193,99],[141,65]]
]
```

Each sub-array is a segment (sequence of 2-D control points).  Consecutive
segments that share an endpoint are rendered as a chain with sharp corners at
the join.

The extended format carries metadata:

```json
{
  "segments": [[[348,803],[329,787]], ...],
  "eta": null
}
```

---

## Build scripts

| Script | Output |
|--------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production app (`dist/`) |
| `npm run build:render` | `dist/glk-render.js` + `.min.js` |
| `npm run build:render-path` | `dist/glk-render-path.js` + `.min.js` |
| `npm test` | Sanity checks (Node.js) |

---

## Code structure

**Math layer** (Legendre / GL internals):

| Module | Purpose |
|--------|---------|
| `legendre.ts` | Legendre polynomials, GL nodes and weights |
| `gleval.ts` | Clenshaw algorithm: evaluate a Legendre series |
| `gl-averaging.ts` | Midpoint averaging (*k* steps → GL-k pre-processing) |
| `gl0-legendre.ts` | GL-0 averaged form → Legendre coefficients |
| `legendrereduce.ts` | Algorithm 2: reduce degree *n+k* → *n* |
| `legendre-endpoints.ts` | Endpoint values/derivatives of Pᵢ |

**GL-k pipeline:**

| Module | Purpose |
|--------|---------|
| `glk-matrix.ts` | Builds the explicit **L**_k matrix: control points → Legendre coefficients |
| `glk-curve.ts` | `sampleGLK(pts, k, nSamples)` for integer *k* |
| `glk-closed.ts` | Periodic extension for closed curves |
| `glk-modified.ts` | Modified GL-k (Section 6): tangent correction via constrained L2 projection |
| `glk-fractional.ts` | Experimental: real-valued *k* by blending L_k and L_{k+1} |
| `glk-svg.ts` | SVG export via Hermite cubic Bézier approximation (M=8 sub-intervals) |

**Renderers:**

| Module | Purpose |
|--------|---------|
| `glk-render.ts` | `render(json, opts?)` — JSON format → SVG string |
| `glk-render-path.ts` | `renderGLKPath(element, opts?)` — GL-k path format → SVG string |

**Editor:**

| Module | Purpose |
|--------|---------|
| `editor.ts` | Entry point |
| `editor-state.ts` | Shared mutable state, undo/redo |
| `editor-draw.ts` | Canvas rendering |
| `editor-interact.ts` | Mouse/keyboard events, save/load |
| `editor-styles.ts` | Style and visibility serialisation |

---

## Notes

- Detailed math notes: [`paper-notes.md`](paper-notes.md)
- GL-k path format design: [`glk-path-format.md`](glk-path-format.md)
- Modified GL-k requires ≥ 4 control points; silently falls back to unmodified for smaller inputs.
- **η (eta)**: tangent scaling for modified GL-k; `null` = paper default 1/ω₀.
- **α (alpha)**: blends between no tangent correction (0) and full correction (1); values outside [0,1] are valid.
