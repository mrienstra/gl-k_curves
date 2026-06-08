/**
 * Top-level GL-k curve pipeline.
 *
 * glkCoeffs(pts, k) → Legendre coefficients of the GL-k curve.
 * sampleGLK(pts, k, nSamples) → array of 2D points on the curve.
 */

import { applyAveraging }    from './gl-averaging';
import { gl0LegendreCoeffs } from './gl0-legendre';
import { legendreReduce }    from './legendrereduce';
import { gleveal }           from './gleval';

/**
 * Compute Legendre coefficients of the GL-k curve defined by control points.
 * pts : array of n+1 points (scalars or equal-length arrays)
 * k   : averaging order (0 = plain GL curve)
 */
export function glkCoeffs(pts: number[], k?: number): number[];
export function glkCoeffs(pts: number[][], k?: number): number[][];
export function glkCoeffs(pts: (number | number[])[], k = 1): (number | number[])[] {
  const averaged = applyAveraging(pts as number[], k);   // n+1 → n+k+1 points
  const f        = gl0LegendreCoeffs(averaged as number[]);  // degree-(n+k) Legendre coeffs
  return legendreReduce(k, f as number[]);               // reduce back to degree n
}

/**
 * Sample the GL-k curve at nSamples evenly-spaced t values in [-1, 1].
 * Returns an array of nSamples points (same type as pts elements).
 */
export function sampleGLK(pts: number[], k?: number, nSamples?: number): number[];
export function sampleGLK(pts: number[][], k?: number, nSamples?: number): number[][];
export function sampleGLK(pts: (number | number[])[], k = 1, nSamples = 200): (number | number[])[] {
  const coeffs = glkCoeffs(pts as number[], k);
  const out: (number | number[])[] = [];
  for (let i = 0; i < nSamples; i++) {
    const t = -Math.cos(Math.PI * i / (nSamples - 1));
    out.push(gleveal(coeffs as number[], t));
  }
  return out;
}
