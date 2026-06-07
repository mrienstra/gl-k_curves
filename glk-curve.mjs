/**
 * Top-level GL-k curve pipeline.
 *
 * glkCoeffs(pts, k) → Legendre coefficients of the GL-k curve.
 * sampleGLK(pts, k, nSamples) → array of 2D points on the curve.
 */

import { applyAveraging }    from './gl-averaging.mjs';
import { gl0LegendreCoeffs } from './gl0-legendre.mjs';
import { legendreReduce }    from './legendrereduce.mjs';
import { gleveal }           from './gleval.mjs';

/**
 * Compute Legendre coefficients of the GL-k curve defined by control points.
 * pts : array of n+1 points (scalars or equal-length arrays)
 * k   : averaging order (0 = plain GL curve)
 */
export function glkCoeffs(pts, k = 1) {
  const averaged = applyAveraging(pts, k);   // n+1 → n+k+1 points
  const f        = gl0LegendreCoeffs(averaged);  // degree-(n+k) Legendre coeffs
  return legendreReduce(k, f);               // reduce back to degree n
}

/**
 * Sample the GL-k curve at nSamples evenly-spaced t values in [-1, 1].
 * Returns an array of nSamples points (same type as pts elements).
 */
export function sampleGLK(pts, k = 1, nSamples = 200) {
  const coeffs = glkCoeffs(pts, k);
  const out = [];
  for (let i = 0; i < nSamples; i++) {
    const t = -Math.cos(Math.PI * i / (nSamples - 1));
    out.push(gleveal(coeffs, t));
  }
  return out;
}
