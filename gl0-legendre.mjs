/**
 * GL-0 basis-change matrix  M_n
 *
 * Converts n+1 control points  p  to Legendre coefficients  c  of the
 * degree-n GL-0 curve:   c = M_n · p
 *
 * Entry  M_n[j][i] = g_{i-1,j} − g_{i,j}
 * where  g_{i,j}  is the j-th Legendre coefficient of  G_i^n(t)
 * (Proposition 2, paper p.4).
 *
 * g_{i,j}  for interior rows  i = 0,...,n−1:
 *   j  <  n :  (1/2)(P_{j-1}(τ_i) − P_{j+1}(τ_i))   [P_{-1} ≡ 0]
 *   j == n  :  (1/2) P_{n-1}(τ_i)                     [top-degree special case]
 *
 * Boundary rows:
 *   g_{-1, j} =  (1/2) δ_{j,0}    (G_{-1}^n = 1/2 = (1/2)P_0)
 *   g_{ n, j} = −(1/2) δ_{j,0}    (G_n^n   = −1/2)
 *
 * Verified for n=1: M_1 = [[1/2, 1/2], [−1/2, 1/2]]
 *   → p(t) = (p_0+p_1)/2 · P_0  +  (p_1−p_0)/2 · P_1
 */

import { legendreP, glNodes } from './legendre.mjs';

// ---------------------------------------------------------------------------

const _gl0MatrixCache = new Map();

/** g_{i,j} — j-th Legendre coeff of G_i^n. */
function gCoeff(i, j, n, nodes) {
  if (i === -1) return j === 0 ?  0.5 : 0;
  if (i ===  n) return j === 0 ? -0.5 : 0;

  const tau = nodes[i];
  if (j === n) return 0.5 * legendreP(n - 1, tau);

  const pjm1 = j === 0 ? 0 : legendreP(j - 1, tau);
  const pjp1 = legendreP(j + 1, tau);
  return 0.5 * (pjm1 - pjp1);
}

/**
 * Build the (n+1) × (n+1) basis-change matrix M_n.
 * Returns a row-major array:  M[j] is a Float64Array of length n+1.
 * Result is memoized: calling with the same n always returns the same object.
 */
export function buildGL0Matrix(n) {
  if (_gl0MatrixCache.has(n)) return _gl0MatrixCache.get(n);
  const nodes = glNodes(n);   // n GL nodes (roots of P_n)
  const M = [];
  for (let j = 0; j <= n; j++) {
    const row = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      row[i] = gCoeff(i - 1, j, n, nodes) - gCoeff(i, j, n, nodes);
    }
    M.push(row);
  }
  _gl0MatrixCache.set(n, M);
  return M;
}

/**
 * Convert control points to Legendre coefficients of the GL-0 curve.
 * controlPts : array of n+1 scalars  OR  n+1 equal-length numeric arrays.
 * Returns    : array of n+1 coefficients (same type as input elements).
 */
export function gl0LegendreCoeffs(controlPts) {
  const n = controlPts.length - 1;
  const M = buildGL0Matrix(n);
  const isVec = Array.isArray(controlPts[0]);

  return M.map(row => {
    if (!isVec) {
      let s = 0;
      for (let i = 0; i <= n; i++) s += row[i] * controlPts[i];
      return s;
    }
    const dim = controlPts[0].length;
    const c = new Array(dim).fill(0);
    for (let i = 0; i <= n; i++)
      for (let d = 0; d < dim; d++)
        c[d] += row[i] * controlPts[i][d];
    return c;
  });
}
