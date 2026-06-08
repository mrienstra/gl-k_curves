/**
 * GL-k closed curve: periodic extension approach.
 *
 * For a closed polygon of n control points (p_0 … p_{n-1}), where p_n = p_0
 * implicitly, we tile `copies` copies of the polygon to produce an open
 * sequence, compute the GL-k curve for that sequence, and return samples from
 * the middle copy of the parameter range.
 *
 * The middle copy sees equal context on both sides, suppressing the boundary
 * effects that would otherwise make the curve non-periodic near the seam.
 * This is the periodic-extension technique analogous to ghost-point repetition
 * in periodic B-splines.
 *
 * Runtime config (read from window.closedCurve each call — change in devtools console
 * then call window.draw() to update):
 *
 *   window.closedCurve.copies   (default 3)  — number of times to tile the polygon
 *   window.closedCurve.showFull (default false) — if true, render the entire extended
 *                                           sequence instead of just the middle copy
 */

import { glkCoeffs } from './glk-curve.mjs';
import { gleveal }   from './gleval.mjs';

/**
 * Sample a closed GL-k curve.
 *
 * @param {Array}  pts      - n control points (closed polygon, first ≠ last)
 * @param {number} k        - GL-k order (0, 1, 2, …)
 * @param {number} nSamples - number of output samples (for the middle copy)
 * @returns {Array} approximately-closed polyline (first ≈ last point)
 */
export function sampleGLKClosed(pts, k = 1, nSamples = 200) {
  const n = pts.length;
  if (n < 2) return [];

  const cfg = (typeof window !== 'undefined' ? window.closedCurve : null) ?? {};
  const copies   = Math.max(2, Math.round(cfg.copies   ?? 3));
  const showFull = cfg.showFull ?? false;

  // Tile `copies` copies of the control polygon
  const extended = [];
  for (let c = 0; c < copies; c++) for (const p of pts) extended.push(p);

  // GL-k Legendre coefficients for the extended sequence
  const coeffs = glkCoeffs(extended, k);

  // Sample `copies * nSamples` points with cosine spacing over [-1, 1]
  const M = copies * nSamples;
  const all = [];
  for (let i = 0; i < M; i++) {
    const t = -Math.cos(Math.PI * i / (M - 1));
    all.push(gleveal(coeffs, t));
  }

  if (showFull) return all;

  // Extract the most central single copy.
  // floor(copies/2) is the 0-indexed middle copy for any copies ≥ 2.
  const midCopy = Math.floor(copies / 2);
  return all.slice(midCopy * nSamples, (midCopy + 1) * nSamples + 1);
}
