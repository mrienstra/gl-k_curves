# GL-k curves

JavaScript implementation of GL-k curves from:
> Ramanantoanina & Hormann, "GL-k Curves", *CAGD* 127, 2026

Detailed math notes from reading the paper are in `paper-notes.md`.

## Running

Requires a local HTTP server (ES modules don't load from `file://`):
```
python3 -m http.server 8000
```
Then open `http://localhost:8000/editor.html`.

Sanity checks: `node sanity-check.mjs`

## Entry points

| File | Purpose |
|------|---------|
| `editor.html` + `editor.mjs` | Interactive canvas editor |
| `basis.html` | GL-k basis function plotter |
| `sanity-check.mjs` | Unit tests (node) |

## Module map

**Low-level** (Legendre math, rarely touched directly):
- `legendre.mjs` — Legendre polynomials, GL nodes + weights
- `legendre-endpoints.mjs` — endpoint values/derivatives of P_i
- `gleval.mjs` — Clenshaw algorithm: evaluate a Legendre series at t
- `gl-averaging.mjs` — midpoint averaging (k steps → GL-k pre-processing)
- `gl0-legendre.mjs` — GL-0 averaged form → Legendre coefficients
- `legendrereduce.mjs` — Algorithm 2 from paper: reduce degree n+k → n

**GL-k pipeline** (the interesting layer):
- `glk-matrix.mjs` — builds explicit L_k matrix: control points → Legendre coefficients
- `glk-curve.mjs` — `sampleGLK(pts, k, nSamples)` for integer k
- `glk-modified.mjs` — modified GL-k (Section 6): tangent correction via constrained L2 projection. `applyTangentOperator` is factored out so it works on any matrix (integer or fractional).
- `glk-fractional.mjs` — experimental (not in paper): blends L_k and L_{k+1} linearly for real-valued k. Preserves endpoint interpolation and partition of unity.
- `glk-svg.mjs` — SVG export: Hermite cubic Bézier approximation (M=8 sub-intervals, exact for n≤3).

## Non-obvious parameters

**η (eta)**: Tangent scaling for modified GL-k. `null` = paper default `1/ω₀` where `ω₀` is the first GL quadrature weight. Exposed as a slider in the editor (0 = auto).

**α (alpha)**: Blends between no tangent correction (α=0, collapses to plain GL-k) and full correction (α=1). Values outside [0,1] are valid — >1 over-corrects (like tension>1 in tension splines), <0 anti-corrects.

**Modified GL-k requires n ≥ 3** (4+ control points). The code silently falls back to unmodified GL-k for smaller inputs.
