/**
 * Endpoint values and derivatives of a Legendre series.
 *
 * For  p(t) = Σ_{i=0}^n  c_i P_i(t):
 *
 *   P_i(1)  =  1           for all i
 *   P_i(-1) = (-1)^i
 *
 *   P_i'(1)  =  d_i        where  d_i = i(i+1)/2
 *   P_i'(-1) = (-1)^{i+1} d_i
 *
 * [Olver et al. 2010, DLMF 18.9.15]
 *
 * Works for scalar or vector coefficients.
 */

/** d_i = i(i+1)/2  — derivative weight at t=1 for P_i. */
export function legendreDWeight(i: number): number {
  return i * (i + 1) / 2;
}

/** Evaluate p(1) = Σ c_i. */
export function evalAt1(coeffs: number[]): number;
export function evalAt1(coeffs: number[][]): number[];
export function evalAt1(coeffs: (number | number[])[]): number | number[] {
  return sumCoeffs(coeffs, (_i) => 1);
}

/** Evaluate p(-1) = Σ (-1)^i c_i. */
export function evalAtMinus1(coeffs: number[]): number;
export function evalAtMinus1(coeffs: number[][]): number[];
export function evalAtMinus1(coeffs: (number | number[])[]): number | number[] {
  return sumCoeffs(coeffs, (i) => (i % 2 === 0 ? 1 : -1));
}

/** Evaluate p'(1) = Σ d_i c_i. */
export function derivAt1(coeffs: number[]): number;
export function derivAt1(coeffs: number[][]): number[];
export function derivAt1(coeffs: (number | number[])[]): number | number[] {
  return sumCoeffs(coeffs, (i) => legendreDWeight(i));
}

/** Evaluate p'(-1) = Σ (-1)^{i+1} d_i c_i. */
export function derivAtMinus1(coeffs: number[]): number;
export function derivAtMinus1(coeffs: number[][]): number[];
export function derivAtMinus1(coeffs: (number | number[])[]): number | number[] {
  return sumCoeffs(coeffs, (i) => (i % 2 === 0 ? -1 : 1) * legendreDWeight(i));
}

// ---- internal --------------------------------------------------------------

function sumCoeffs(
  coeffs: (number | number[])[],
  weight: (i: number) => number,
): number | number[] {
  const isVec = Array.isArray(coeffs[0]);
  if (!isVec) {
    let s = 0;
    for (let i = 0; i < coeffs.length; i++) s += weight(i) * (coeffs[i] as number);
    return s;
  }
  const dim = (coeffs[0] as number[]).length;
  const out = new Array<number>(dim).fill(0);
  for (let i = 0; i < coeffs.length; i++) {
    const w = weight(i);
    for (let d = 0; d < dim; d++) out[d] += w * (coeffs[i] as number[])[d];
  }
  return out;
}
