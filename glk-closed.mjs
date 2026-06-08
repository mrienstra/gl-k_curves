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
 *   window.closedCurve.seamT    (default null)  — override the half-width of the
 *                                           sampled parameter range (null = auto)
 *
 * Seam T: the sampled range is [-seamT, +seamT] (symmetric around 0).
 * Auto-compute minimises dist(curve(-t), curve(+t)) — the actual start/end
 * gap of the sampled segment — which correctly handles asymmetric shapes.
 * The equal-cosine-spacing default would be -cos(π*(midCopy+1)/copies),
 * e.g. 0.5 for copies=3; but the true optimum is a bit smaller for each k.
 */

import { glkCoeffs } from "./glk-curve";
import { gleveal } from "./gleval";
import { applyMatrix } from "./glk-matrix";
import {
  buildModifiedGLKMatrix,
  applyTangentOperator,
} from "./glk-modified";
import { buildGLKMatrixFractional } from "./glk-fractional";
import { glWeights } from "./legendre";

// ---------------------------------------------------------------------------
// Seam-T helpers (cosSeamT and findSeamT also exported for glk-svg.mjs)
// ---------------------------------------------------------------------------

/**
 * Equal-cosine-spacing seam half-width — the "naive" value used before
 * this investigation.  For copies=3 it equals 0.5; decreases with copies.
 */
export function cosSeamT(copies) {
  const midCopy = Math.floor(copies / 2);
  return -Math.cos(Math.PI * (midCopy + 1) / copies);
}

/**
 * Find the seam half-width: the t > 0 in [tLo, tHi] that minimizes the gap
 * between curve(-t) and curve(+t) — the visual start/end distance of the
 * sampled segment.
 *
 * This is more robust than minimizing dist(curve(t), p0) for asymmetric
 * shapes, where the curve may approach p0 from an oblique angle that does
 * not correspond to actual seam closure.
 *
 * The `p0` parameter is retained for call-site compatibility but is no longer
 * used by the optimization.
 *
 * Uses a 60-point scan followed by golden-section refinement.
 */
export function findSeamT(coeffs, p0, copies) {
  const tCos  = cosSeamT(copies);
  const tLo   = Math.max(0.05, tCos - 0.35);
  const tHi   = tCos + 0.15;
  const SCAN  = 60;

  function gap(t) {
    const a = gleveal(coeffs, -t), b = gleveal(coeffs, t);
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  let bestT = tCos, bestD = Infinity;
  for (let i = 0; i <= SCAN; i++) {
    const t = tLo + (tHi - tLo) * i / SCAN;
    const d = gap(t);
    if (d < bestD) { bestD = d; bestT = t; }
  }

  // Golden-section refinement inside a bracket around bestT
  const step = (tHi - tLo) / SCAN;
  let lo = Math.max(tLo, bestT - step * 1.5);
  let hi = Math.min(tHi, bestT + step * 1.5);
  const GR = 0.6180339887;
  for (let iter = 0; iter < 40; iter++) {
    const m1 = hi - GR * (hi - lo);
    const m2 = lo + GR * (hi - lo);
    if (gap(m1) < gap(m2)) hi = m2; else lo = m1;
  }
  return (lo + hi) / 2;
}

/** Sample `nSamples+1` points cosine-spaced over [-seamT, +seamT]. */
function sampleSymmetric(coeffs, seamT, nSamples) {
  const out = [];
  for (let i = 0; i <= nSamples; i++) {
    const t = seamT * Math.cos(Math.PI * (nSamples - i) / nSamples);
    out.push(gleveal(coeffs, t));
  }
  return out;
}

/**
 * Compute the auto-seamT value that sampleGLKClosed would use for a given k.
 * Exported so the UI can display it without re-running the sampler.
 *
 * @param {Array}  pts    - closed control points (first === last)
 * @param {number} copies - tiling count (will be forced odd)
 * @param {number} k      - GL-k order
 */
export function computeAutoSeamT(pts, copies, k = 1) {
  if (pts.length < 3) return cosSeamT(copies);
  let c = Math.max(2, Math.round(copies ?? 3));
  if (c % 2 === 0) c++;
  const tile = pts.slice(0, pts.length - 1);
  const extended = [];
  for (let cc = 0; cc < c; cc++) for (const p of tile) extended.push(p);
  extended.push(tile[0]);
  return findSeamT(glkCoeffs(extended, k), tile[0], c);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sample a closed GL-k curve.
 *
 * @param {Array}  pts      - control points; first and last must be the same point
 *                            (the coincident seam point produced by "Close segment")
 * @param {number} k        - GL-k order (0, 1, 2, …)
 * @param {number} nSamples - number of output samples (for the middle copy)
 * @param {object} opts     - optional per-segment config (overrides window.closedCurve)
 * @returns {Array} approximately-closed polyline (first ≈ last point)
 */
export function sampleGLKClosed(pts, k = 1, nSamples = 200, opts = null) {
  if (pts.length < 3) return [];

  const cfg = opts ?? (typeof window !== "undefined" ? window.closedCurve : null) ?? {};
  let copies = Math.max(2, Math.round(cfg.copies ?? 3));
  if (copies % 2 === 0) copies++; // must be odd so the middle copy has equal context on both sides
  const showFull = cfg.showFull ?? false;

  // Drop the trailing duplicate endpoint before tiling.
  const tile = pts.slice(0, pts.length - 1);

  const extended = [];
  for (let c = 0; c < copies; c++) for (const p of tile) extended.push(p);
  extended.push(tile[0]);

  const coeffs = glkCoeffs(extended, k);

  if (showFull) {
    const M = copies * nSamples;
    const all = [];
    for (let i = 0; i < M; i++) {
      const t = -Math.cos((Math.PI * i) / (M - 1));
      all.push(gleveal(coeffs, t));
    }
    return all;
  }

  const seamT = cfg.seamT != null
    ? cfg.seamT
    : findSeamT(coeffs, tile[0], copies);

  return sampleSymmetric(coeffs, seamT, nSamples);
}

// ---------------------------------------------------------------------------
// Generalized closed-curve sampler
// ---------------------------------------------------------------------------

/**
 * Shared implementation for non-integer-GL-k closed-curve variants.
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

  if (showFull) {
    const M = copies * nSamples;
    const all = [];
    for (let i = 0; i < M; i++) {
      const t = -Math.cos((Math.PI * i) / (M - 1));
      all.push(gleveal(coeffs, t));
    }
    return all;
  }

  const seamT = cfg.seamT != null
    ? cfg.seamT
    : findSeamT(coeffs, tile[0], copies);

  return sampleSymmetric(coeffs, seamT, nSamples);
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
