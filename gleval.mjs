/**
 * Algorithm 1 (GLEVAL) from the paper — linear-time evaluation of a curve
 * expressed in the Legendre basis:
 *
 *   p(t) = sum_{j=0}^{n} c_j * P_j(t),   t in [-1, 1]
 *
 * where P_j is the j-th Legendre polynomial.
 *
 * coeffs may be an array of scalars or an array of vectors (arrays);
 * in the vector case each c_j is added component-wise.
 */

/**
 * Evaluate p(t) given Legendre coefficients `coeffs` = [c_0, c_1, ..., c_n].
 *
 * Works for scalar coefficients (numbers) and vector coefficients (arrays).
 * Returns the same type as the coefficient elements.
 */
export function gleveal(coeffs, t) {
  const n = coeffs.length - 1;
  if (n < 0) throw new Error('coeffs must be non-empty');

  const isVec = Array.isArray(coeffs[0]);
  const add   = isVec ? vecAdd   : (a, b) => a + b;
  const scale = isVec ? vecScale : (s, v) => s * v;

  if (n === 0) return coeffs[0];

  // r2 = P_{j-2}(t),  r1 = P_{j-1}(t),  running in scalar
  let r2 = 1;  // P_0
  let r1 = t;  // P_1

  let p = add(coeffs[0], scale(t, coeffs[1]));   // c_0*P_0 + c_1*P_1

  for (let j = 2; j <= n; j++) {
    const alpha = (2 * j - 1) / j;
    const beta  = (j - 1)     / j;
    const rj = alpha * t * r1 - beta * r2;       // P_j(t), scalar recurrence
    p  = add(p, scale(rj, coeffs[j]));
    r2 = r1;
    r1 = rj;
  }

  return p;
}

// ---- tiny vector helpers (no external deps) --------------------------------

function vecAdd(a, b) {
  return a.map((v, i) => v + b[i]);
}

function vecScale(s, v) {
  return v.map(x => s * x);
}
