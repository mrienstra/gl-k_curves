/**
 * Fractional GL-k curves (experimental — not from the paper).
 *
 * For non-integer k = floor(k) + f  (f ∈ [0,1)):
 *
 *   L_{k+f} = (1−f)·L_{floor(k)} + f·L_{ceil(k)}
 *
 * The blend is a valid linear map from n+1 control points to Legendre
 * coefficients, giving a well-defined degree-n polynomial curve that morphs
 * continuously between integer GL-k variants as k varies.
 *
 * Properties preserved by linearity of the blend:
 *   - Endpoint interpolation  p(−1) = p_0,  p(1) = p_n
 *   - Partition of unity  Σ_i C_i^k(t) = 1
 *
 * Properties NOT generally preserved:
 *   - The paper's minimum-negativity bounds on basis functions
 *   - Tangent properties (those are nonlinear constraints)
 */

import { buildGLKMatrix, applyMatrix } from './glk-matrix.mjs';
import { applyTangentOperator }        from './glk-modified.mjs';
import { glWeights }                   from './legendre.mjs';
import { gleveal }                     from './gleval.mjs';

/**
 * Build the blended L_k matrix for real-valued k ≥ 0.
 * For integer k, identical to buildGLKMatrix(n, k).
 */
export function buildGLKMatrixFractional(n, k) {
  const k0 = Math.floor(k);
  const f  = k - k0;
  if (f < 1e-10) return buildGLKMatrix(n, k0);  // exact integer, no blend needed

  const L0 = buildGLKMatrix(n, k0);
  const L1 = buildGLKMatrix(n, k0 + 1);
  return L0.map((row0, j) => {
    const row1    = L1[j];
    const blended = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) blended[i] = (1 - f) * row0[i] + f * row1[i];
    return blended;
  });
}

/**
 * Sample the fractional GL-k curve at nSamples evenly-spaced t ∈ [-1,1].
 */
export function sampleGLKFractional(pts, k = 1, nSamples = 200) {
  const n      = pts.length - 1;
  const L      = buildGLKMatrixFractional(n, k);
  const coeffs = applyMatrix(L, pts);
  const out    = [];
  for (let i = 0; i < nSamples; i++) {
    const t = -Math.cos(Math.PI * i / (nSamples - 1));
    out.push(gleveal(coeffs, t));
  }
  return out;
}

/**
 * Sample the modified (tangent-corrected) fractional GL-k curve.
 * Applies the same tangent operator as mod GL-k, but on top of the
 * fractionally-blended base matrix.  Requires n ≥ 3.
 * alpha blends between no correction (0) and full correction (1); values
 * outside [0,1] give over/under-correction.
 */
export function sampleModifiedGLKFractional(pts, k = 1, nSamples = 200, eta1 = null, eta2 = null, alpha = 1) {
  const n = pts.length - 1;
  if (n < 3) return sampleGLKFractional(pts, k, nSamples);  // fallback: no tangent correction

  if (eta1 === null || eta2 === null) {
    const w0 = glWeights(n)[0];
    if (eta1 === null) eta1 = 1 / w0;
    if (eta2 === null) eta2 = 1 / w0;
  }

  const L      = buildGLKMatrixFractional(n, k);
  const Ltilde = applyTangentOperator(n, L, eta1, eta2, alpha);
  const coeffs = applyMatrix(Ltilde, pts);
  const out    = [];
  for (let i = 0; i < nSamples; i++) {
    const t = -Math.cos(Math.PI * i / (nSamples - 1));
    out.push(gleveal(coeffs, t));
  }
  return out;
}
