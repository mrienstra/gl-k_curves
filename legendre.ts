/**
 * Legendre polynomial evaluation and Gauss-Legendre node finding.
 *
 * The n Gauss-Legendre (GL) nodes are the n roots of P_n on (-1, 1).
 * For a GL-k curve of degree n we need exactly n such nodes (not n+1).
 */

/**
 * Evaluate P_n(t) and P_n'(t) simultaneously using the 3-term recurrence:
 *   P_0 = 1,  P_1 = t
 *   P_j = ((2j-1)/j) * t * P_{j-1}  -  ((j-1)/j) * P_{j-2}
 */
export function legendreAndDeriv(n: number, t: number): { p: number; dp: number } {
  if (n === 0) return { p: 1, dp: 0 };
  if (n === 1) return { p: t, dp: 1 };

  let p0 = 1, dp0 = 0;   // P_{j-2}, P'_{j-2}
  let p1 = t, dp1 = 1;   // P_{j-1}, P'_{j-1}

  for (let j = 2; j <= n; j++) {
    const a = (2 * j - 1) / j;
    const b = (j - 1) / j;
    const p2  = a * t * p1  - b * p0;
    const dp2 = a * (p1 + t * dp1) - b * dp0;
    p0 = p1; dp0 = dp1;
    p1 = p2; dp1 = dp2;
  }
  return { p: p1, dp: dp1 };
}

/** Evaluate just P_n(t). */
export function legendreP(n: number, t: number): number {
  return legendreAndDeriv(n, t).p;
}

/**
 * Compute the n Gauss-Legendre nodes on (-1, 1) — the roots of P_n.
 * Uses Newton's method starting from Chebyshev initial guesses.
 * Nodes are returned in ascending order.
 */
export function glNodes(n: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];

  const nodes = new Array<number>(n);

  // The roots of P_n are symmetric about 0; iterate over the left half
  // and mirror.  For odd n the middle root is exactly 0.
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    // Chebyshev-based initial guess (good start for GL nodes)
    let x = -Math.cos(Math.PI * (2 * i + 1) / (2 * n));

    for (let iter = 0; iter < 100; iter++) {
      const { p, dp } = legendreAndDeriv(n, x);
      const dx = -p / dp;
      x += dx;
      if (Math.abs(dx) < 1e-15) break;
    }

    nodes[i] = x;
    nodes[n - 1 - i] = -x;   // symmetric partner
  }

  // If n is odd the middle root is 0 exactly
  if (n % 2 === 1) nodes[(n - 1) / 2] = 0;

  return nodes;
}

/**
 * Compute the n Gauss-Legendre quadrature weights corresponding to glNodes(n).
 * Formula:  w_i = 2 / ((1 - τ_i²) * (P_n'(τ_i))²)
 * Weights are returned in the same order as glNodes(n).
 */
export function glWeights(n: number): number[] {
  const nodes = glNodes(n);
  return nodes.map(t => {
    const { dp } = legendreAndDeriv(n, t);
    return 2 / ((1 - t * t) * dp * dp);
  });
}
