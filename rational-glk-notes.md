# Rational GL-k curves (per-point weights)

Mathematically coherent because GL-k basis functions form a partition of unity.
Standard homogeneous-coords approach (same as NURBS generalizing B-splines):
- lift: `(x, y) → (wx, wy, w)`
- run GL-k pipeline as-is (it's linear)
- project back: divide by w component

Implementation in `glk-curve.mjs` would be straightforward.

**Complication**: modified GL-k tangent correction (Section 6) doesn't carry over cleanly
to the rational setting — quotient rule means the correction loses its geometric meaning.
Probably skip or apply only to spatial components.

SVG export (`glk-svg.mjs`) also needs rethinking — Hermite data extraction assumes linear.
