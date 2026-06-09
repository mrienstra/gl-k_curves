# GL-k curves

TypeScript implementation of GL-k curves from:
> Ramanantoanina & Hormann, "GL-k Curves", *CAGD* 127, 2026

Detailed math notes from reading the paper are in `paper-notes.md`.

## Running

```
npm run dev
```
Vite prints the local URL (typically `http://localhost:5173`). Open `editor.html`.

Sanity checks: `npm test`

## Entry points

| File | Purpose |
|------|---------|
| `editor.html` + `editor.ts` | Interactive canvas editor |
| `basis.html` | GL-k basis function plotter |
| `sanity-check.ts` | Unit tests (node) |

## Module map

**Low-level** (Legendre math, rarely touched directly):
- `legendre.ts` — Legendre polynomials, GL nodes + weights
- `legendre-endpoints.ts` — endpoint values/derivatives of P_i
- `gleval.ts` — Clenshaw algorithm: evaluate a Legendre series at t
- `gl-averaging.ts` — midpoint averaging (k steps → GL-k pre-processing)
- `gl0-legendre.ts` — GL-0 averaged form → Legendre coefficients
- `legendrereduce.ts` — Algorithm 2 from paper: reduce degree n+k → n

**GL-k pipeline** (the interesting layer):
- `glk-matrix.ts` — builds explicit L_k matrix: control points → Legendre coefficients
- `glk-curve.ts` — `sampleGLK(pts, k, nSamples)` for integer k
- `glk-closed.ts` — periodic extension for closed curves; `sampleGLKClosed` and variants
- `glk-modified.ts` — modified GL-k (Section 6): tangent correction via constrained L2 projection. `applyTangentOperator` is factored out so it works on any matrix (integer or fractional).
- `glk-fractional.ts` — experimental (not in paper): blends L_k and L_{k+1} linearly for real-valued k. Preserves endpoint interpolation and partition of unity.
- `glk-svg.ts` — SVG export: Hermite cubic Bézier approximation (M=8 sub-intervals, exact for n≤3).

## Non-obvious parameters

**η (eta)**: Tangent scaling for modified GL-k. `null` = paper default `1/ω₀` where `ω₀` is the first GL quadrature weight. Exposed as a slider in the editor (0 = auto).

**α (alpha)**: Blends between no tangent correction (α=0, collapses to plain GL-k) and full correction (α=1). Values outside [0,1] are valid — >1 over-corrects (like tension>1 in tension splines), <0 anti-corrects.

**Modified GL-k requires n ≥ 3** (4+ control points). The code silently falls back to unmodified GL-k for smaller inputs.
