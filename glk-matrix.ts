/**
 * Build L_k — the (n+1)×(n+1) matrix that maps control points to
 * Legendre coefficients of the GL-k curve:
 *
 *   c = L_k · p
 *
 * L_k = R_k · M_{n+k} · A_k · ... · A_1
 *
 * Constructed by running the full pipeline on each standard basis vector.
 * Costs O(n²) — meant to be precomputed once per (n, k) pair.
 *
 * Returns a row-major array: L[j] is a Float64Array of length n+1,
 * so that  c[j] = Σ_i  L[j][i] · p[i].
 */

import { glkCoeffs } from './glk-curve';

const _glkMatrixCache = new Map<string, Float64Array[]>();

export function buildGLKMatrix(n: number, k: number): Float64Array[] {
  const key = `${n},${k}`;
  const cached = _glkMatrixCache.get(key);
  if (cached !== undefined) return cached;

  const L = Array.from({ length: n + 1 }, () => new Float64Array(n + 1));
  for (let i = 0; i <= n; i++) {
    const e = new Array<number>(n + 1).fill(0);
    e[i] = 1;
    const col = glkCoeffs(e, k);
    for (let j = 0; j <= n; j++) L[j][i] = col[j];
  }
  _glkMatrixCache.set(key, L);
  return L;
}

/** Apply L (row-major) to a vector of scalars or equal-length arrays. */
export function applyMatrix(L: Float64Array[], pts: number[]): number[];
export function applyMatrix(L: Float64Array[], pts: number[][]): number[][];
export function applyMatrix(L: Float64Array[], pts: (number | number[])[]): (number | number[])[] {
  const isVec = Array.isArray(pts[0]);
  return L.map(row => {
    if (!isVec) {
      let s = 0;
      for (let i = 0; i < row.length; i++) s += row[i] * (pts[i] as number);
      return s;
    }
    const dim = (pts[0] as number[]).length;
    const out = new Array<number>(dim).fill(0);
    for (let i = 0; i < row.length; i++)
      for (let d = 0; d < dim; d++)
        out[d] += row[i] * (pts[i] as number[])[d];
    return out;
  });
}
