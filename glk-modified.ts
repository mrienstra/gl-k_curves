/**
 * Modified GL-k curves (Section 6 of the paper).
 *
 * The tangent operator T_k adjusts the GL-k Legendre coefficients so the
 * curve's tangent direction at each endpoint aligns with the first/last
 * polygon edge, while staying as close as possible in L2.
 *
 * Constraint:  D · c̃ = E · p   (4 scalar equations per spatial dimension)
 *
 *   D  ∈ R^{4×(n+1)}  — reads off endpoint values + derivatives from Legendre coeffs
 *   E  ∈ R^{4×(n+1)}  — what we want: endpoint interpolation + tangent directions
 *
 * Solution (constrained L2 projection):
 *   L̃_k = L_k + W^{-1} D^T (D W^{-1} D^T)^{-1} (E − D L_k)
 *
 *   W   = diag(2/(2i+1))  (L2 norm of P_i on [-1,1])
 *   W^{-1} = diag((2i+1)/2)
 */

import { buildGLKMatrix, applyMatrix } from './glk-matrix';
import { legendreDWeight }             from './legendre-endpoints';
import { gleveal }                     from './gleval';
import { glWeights }                   from './legendre';

// ---------------------------------------------------------------------------
// D matrix: D[r][i] encodes endpoint evaluation / differentiation of P_i
//
//   row 0: P_i(-1) = (-1)^i             ← value at t=-1
//   row 1: P_i(1)  = 1                  ← value at t=1
//   row 2: P_i'(-1) = (-1)^{i+1} d_i   ← derivative at t=-1
//   row 3: P_i'(1)  = d_i              ← derivative at t=1
// ---------------------------------------------------------------------------
function buildD(n: number): Float64Array[] {
  const D = Array.from({ length: 4 }, () => new Float64Array(n + 1));
  for (let i = 0; i <= n; i++) {
    const sign = (i % 2 === 0) ? 1 : -1;
    const di   = legendreDWeight(i);
    D[0][i] =  sign;      // P_i(-1)
    D[1][i] =  1;         // P_i(1)
    D[2][i] = -sign * di; // P_i'(-1) = (-1)^{i+1} d_i
    D[3][i] =  di;        // P_i'(1)
  }
  return D;
}

// E matrix: what we want D·c̃ to equal (acts on control points p)
//
//   row 0: p_0             (keep value at t=-1 = p_0)
//   row 1: p_n             (keep value at t=1  = p_n)
//   row 2: η1*(p_1 - p_0)  (tangent at t=-1 parallel to first edge)
//   row 3: η2*(p_n-p_{n-1})(tangent at t=1  parallel to last  edge)
function buildE(n: number, eta1: number, eta2: number): Float64Array[] {
  const E = Array.from({ length: 4 }, () => new Float64Array(n + 1));
  E[0][0] = 1;                           // p_0
  E[1][n] = 1;                           // p_n
  E[2][0] = -eta1;  E[2][1] = eta1;     // eta1*(p_1 - p_0)
  E[3][n - 1] = -eta2; E[3][n] = eta2;  // eta2*(p_n - p_{n-1})
  return E;
}

// M = D W^{-1} D^T  (4×4)
function buildM(D: Float64Array[], n: number): Float64Array[] {
  const M = Array.from({ length: 4 }, () => new Float64Array(4));
  for (let r = 0; r < 4; r++)
    for (let s = 0; s < 4; s++) {
      let sum = 0;
      for (let i = 0; i <= n; i++)
        sum += D[r][i] * ((2 * i + 1) / 2) * D[s][i];
      M[r][s] = sum;
    }
  return M;
}

// 4×4 Gaussian elimination with partial pivoting → returns M^{-1}
function invert4(M: number[][]): number[][] {
  const n = 4;
  // Augmented matrix [M | I]
  const A: number[][] = M.map((row, i) => {
    const r = [...row, ...Array<number>(n).fill(0)];
    r[n + i] = 1;
    return r;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];

    const pivot = A[col][col];
    for (let j = col; j < 2 * n; j++) A[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = col; j < 2 * n; j++) A[row][j] -= factor * A[col][j];
    }
  }
  return A.map(row => row.slice(n));
}

// mat4 × mat  (4×(n+1) result from 4×4 and 4×(n+1))
function mul4xN(A4: number[][], B: Float64Array[], n: number): Float64Array[] {
  return Array.from({ length: 4 }, (_, r) => {
    const row = new Float64Array(n + 1);
    for (let c = 0; c <= n; c++)
      for (let k = 0; k < 4; k++) row[c] += A4[r][k] * B[k][c];
    return row;
  });
}

// ---------------------------------------------------------------------------

/**
 * Apply the tangent operator T to an arbitrary (n+1)×(n+1) matrix L,
 * returning L̃ = L + α · W^{-1} D^T (D W^{-1} D^T)^{-1} (E − D L).
 *
 * alpha=1 gives the full tangent correction; alpha=0 leaves L unchanged;
 * values outside [0,1] are valid (over/under-correction).
 *
 * This is the core correction step, factored out so it can be applied to
 * any base matrix (integer GL-k, fractional blend, etc.).
 *
 * Requires n ≥ 3 (caller is responsible for checking).
 */
export function applyTangentOperator(
  n: number,
  Lk: Float64Array[],
  eta1: number,
  eta2: number,
  alpha = 1,
): Float64Array[] {
  const D    = buildD(n);
  const E    = buildE(n, eta1, eta2);
  const M    = buildM(D, n);
  const Minv = invert4(M.map(r => [...r]));

  // B = E - D Lk  (4×(n+1))
  const B: Float64Array[] = Array.from({ length: 4 }, (_, r) => {
    const row = new Float64Array(n + 1);
    for (let c = 0; c <= n; c++) {
      row[c] = E[r][c];
      for (let j = 0; j <= n; j++) row[c] -= D[r][j] * Lk[j][c];
    }
    return row;
  });

  // C = Minv · B  (4×(n+1))
  const C = mul4xN(Minv, B, n);

  // L̃[j][i] = Lk[j][i] + (2j+1)/2 * Σ_r D[r][j] * C[r][i]
  return Lk.map((lkRow, j) => {
    const row = new Float64Array(n + 1);
    const wj  = (2 * j + 1) / 2;
    for (let i = 0; i <= n; i++) {
      let corr = 0;
      for (let r = 0; r < 4; r++) corr += D[r][j] * C[r][i];
      row[i] = lkRow[i] + alpha * wj * corr;
    }
    return row;
  });
}

/**
 * Resolve eta defaults (null → 1/ω₀) and return [eta1, eta2].
 */
function resolveEta(
  n: number,
  eta1: number | null,
  eta2: number | null,
): [number, number] {
  if (eta1 === null || eta2 === null) {
    const w0 = glWeights(n)[0];
    if (eta1 === null) eta1 = 1 / w0;
    if (eta2 === null) eta2 = 1 / w0;
  }
  return [eta1, eta2];
}

/**
 * Build L̃_k — the modified GL-k transform matrix (n+1)×(n+1).
 *
 * eta1, eta2: tangent scaling at t=-1 and t=1.
 *   Default (null): 1/w_0 where w_0 is the first GL quadrature weight —
 *                   this matches the GL-0 derivative magnitude at τ_0 (paper default).
 */
export function buildModifiedGLKMatrix(
  n: number,
  k: number,
  eta1: number | null = null,
  eta2: number | null = null,
  alpha = 1,
): Float64Array[] {
  // For n < 3: D is 4×(n+1) with n+1 < 4, so M = D W^{-1} D^T is rank-deficient.
  // Fall back to unmodified GL-k.
  if (n < 3) return buildGLKMatrix(n, k);
  [eta1, eta2] = resolveEta(n, eta1, eta2);
  return applyTangentOperator(n, buildGLKMatrix(n, k), eta1, eta2, alpha);
}

/**
 * Sample the modified GL-k curve at nSamples points.
 */
export function sampleModifiedGLK(
  pts: number[][],
  k = 1,
  nSamples = 200,
  eta1: number | null = null,
  eta2: number | null = null,
  alpha = 1,
): number[][] {
  const n      = pts.length - 1;
  const Ltilde = buildModifiedGLKMatrix(n, k, eta1, eta2, alpha);
  const coeffs = applyMatrix(Ltilde, pts);
  const out: number[][] = [];
  for (let i = 0; i < nSamples; i++) {
    const t = -Math.cos(Math.PI * i / (nSamples - 1));
    out.push(gleveal(coeffs, t));
  }
  return out;
}
