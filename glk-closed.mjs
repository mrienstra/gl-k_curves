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

import { glkCoeffs } from "./glk-curve.mjs";
import { gleveal } from "./gleval.mjs";
import { applyMatrix } from "./glk-matrix.mjs";
import {
  buildModifiedGLKMatrix,
  applyTangentOperator,
} from "./glk-modified.mjs";
import { buildGLKMatrixFractional } from "./glk-fractional.mjs";
import { glWeights } from "./legendre.mjs";

/**
 * Sample a closed GL-k curve.
 *
 * @param {Array}  pts      - control points; first and last must be the same point
 *                            (the coincident seam point produced by "Close segment")
 * @param {number} k        - GL-k order (0, 1, 2, …)
 * @param {number} nSamples - number of output samples (for the middle copy)
 * @returns {Array} approximately-closed polyline (first ≈ last point)
 */
export function sampleGLKClosed(pts, k = 1, nSamples = 200, opts = null) {
  if (pts.length < 3) return [];

  const cfg = opts ?? (typeof window !== "undefined" ? window.closedCurve : null) ?? {};
  let copies = Math.max(2, Math.round(cfg.copies ?? 3));
  if (copies % 2 === 0) copies++; // must be odd so the middle copy has equal context on both sides
  const showFull = cfg.showFull ?? false;

  // Drop the trailing duplicate endpoint before tiling.
  // pts = [p0, p1, …, p_{n-2}, p0]; the fundamental period is [p0, …, p_{n-2}].
  // Without this, consecutive copies would share a doubled seam point:
  //   …p_{n-2}, p0, p0, p1, …   ← wrong
  // With it:
  //   …p_{n-2}, p0, p1, …       ← correct
  const tile = pts.slice(0, pts.length - 1);

  // Tile `copies` copies of the fundamental period, then close with p0 again so the
  // middle copy spans exactly one period: from the (midCopy)th p0 to the (midCopy+1)th p0.
  const extended = [];
  for (let c = 0; c < copies; c++) for (const p of tile) extended.push(p);
  extended.push(tile[0]);

  // GL-k Legendre coefficients for the extended sequence
  const coeffs = glkCoeffs(extended, k);

  // Sample `copies * nSamples` points with cosine spacing over [-1, 1]
  const M = copies * nSamples;
  const all = [];
  for (let i = 0; i < M; i++) {
    const t = -Math.cos((Math.PI * i) / (M - 1));
    all.push(gleveal(coeffs, t));
  }

  if (showFull) return all;

  // Extract the most central single copy.
  // floor(copies/2) is the 0-indexed middle copy for any copies ≥ 2.
  const midCopy = Math.floor(copies / 2);
  return all.slice(midCopy * nSamples, (midCopy + 1) * nSamples + 1);
}

// ---------------------------------------------------------------------------
// Generalized closed-curve sampler
// ---------------------------------------------------------------------------

/**
 * Shared implementation for non-integer-GL-k closed-curve variants.
 *
 * Builds the extended sequence, applies matrixFn(n) to get an (n+1)×(n+1)
 * coefficient matrix, evaluates the Legendre series at copies*nSamples points,
 * and returns the middle-copy slice (same windowing as sampleGLKClosed).
 *
 * matrixFn receives the degree n of the *extended* sequence.  eta/alpha should
 * be resolved inside matrixFn so they are based on the correct n.
 */
function _sampleClosedWithMatrix(pts, matrixFn, nSamples, opts = null) {
  const cfg = opts ?? (typeof window !== "undefined" ? window.closedCurve : null) ?? {};
  let copies = Math.max(2, Math.round(cfg.copies ?? 3));
  if (copies % 2 === 0) copies++; // must be odd so the middle copy has equal context on both sides
  const showFull = cfg.showFull ?? false;

  const tile = pts.slice(0, pts.length - 1);
  const extended = [];
  for (let c = 0; c < copies; c++) for (const p of tile) extended.push(p);
  extended.push(tile[0]);

  const n = extended.length - 1;
  const L = matrixFn(n);
  const coeffs = applyMatrix(L, extended);

  const M = copies * nSamples;
  const all = [];
  for (let i = 0; i < M; i++) {
    const t = -Math.cos((Math.PI * i) / (M - 1));
    all.push(gleveal(coeffs, t));
  }
  if (showFull) return all;
  const midCopy = Math.floor(copies / 2);
  return all.slice(midCopy * nSamples, (midCopy + 1) * nSamples + 1);
}

/** Sample a closed fractional GL-k curve. */
export function sampleGLKFractionalClosed(pts, k = 1, nSamples = 200, opts = null) {
  if (pts.length < 3) return [];
  return _sampleClosedWithMatrix(
    pts,
    (n) => buildGLKMatrixFractional(n, k),
    nSamples,
    opts,
  );
}

/** Sample a closed modified GL-k curve (tangent-corrected). */
export function sampleModifiedGLKClosed(
  pts,
  k = 1,
  nSamples = 200,
  eta1 = null,
  eta2 = null,
  alpha = 1,
  opts = null,
) {
  if (pts.length < 3) return [];
  return _sampleClosedWithMatrix(
    pts,
    (n) => {
      let e1 = eta1,
        e2 = eta2;
      if (e1 === null || e2 === null) {
        const w0 = glWeights(n)[0];
        if (e1 === null) e1 = 1 / w0;
        if (e2 === null) e2 = 1 / w0;
      }
      return buildModifiedGLKMatrix(n, k, e1, e2, alpha);
    },
    nSamples,
    opts,
  );
}

/** Sample a closed modified fractional GL-k curve. */
export function sampleModifiedGLKFractionalClosed(
  pts,
  k = 1,
  nSamples = 200,
  eta1 = null,
  eta2 = null,
  alpha = 1,
  opts = null,
) {
  if (pts.length < 3) return [];
  return _sampleClosedWithMatrix(
    pts,
    (n) => {
      let e1 = eta1,
        e2 = eta2;
      if (e1 === null || e2 === null) {
        const w0 = glWeights(n)[0];
        if (e1 === null) e1 = 1 / w0;
        if (e2 === null) e2 = 1 / w0;
      }
      const Lf = buildGLKMatrixFractional(n, k);
      return n >= 3 ? applyTangentOperator(n, Lf, e1, e2, alpha) : Lf;
    },
    nSamples,
    opts,
  );
}
