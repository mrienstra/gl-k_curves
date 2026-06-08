/**
 * Algorithm 2 — LEGENDREREDUCE(k, f)
 *
 * Applies the reduction operator R_k : Π_{n+k} → Π_n in O(n+k) time.
 *
 * Given Legendre coefficients f = [f_0,...,f_{n+k}] of a degree-(n+k)
 * polynomial, returns g = [g_0,...,g_n], the Legendre coefficients of the
 * degree-n polynomial that:
 *   - minimises ||f − g||_{L2[-1,1]}
 *   - satisfies g(−1) = f(−1) and g(1) = f(1)   (endpoint interpolation)
 *
 * Works for scalar coefficients or equal-length vector coefficients.
 *
 * Formula (derived / confirmed against paper Lemma 1):
 *   g_i = f_i + s_{ij} · f_{n+j}   summed over j = 1,...,k
 *
 *   s_{ij} = 0                          if n+i+j is odd
 *   s_{ij} = 2(2i+1) / (n(n+1))        if n+i+j even and j odd
 *   s_{ij} = 2(2i+1) / ((n+1)(n+2))    if n+i+j even and j even
 *
 * Algorithm 2 reformulates this via two scalar accumulators σ_e, σ_o so
 * only one pass over the tail (j=1..k) and one pass over the output (i=0..n)
 * are needed.
 */

export function legendreReduce(k: number, f: number[]): number[];
export function legendreReduce(k: number, f: number[][]): number[][];
export function legendreReduce(k: number, f: (number | number[])[]): (number | number[])[] {
  if (k === 0) return f.slice(0, f.length);   // R_0 = identity

  const m = f.length - 1;   // degree of f
  const n = m - k;

  const isVec = Array.isArray(f[0]);

  // Accumulate tail coefficients into two buckets by parity of (n+j).
  // σ_e: f_{n+j} where n+j is even
  // σ_o: f_{n+j} where n+j is odd
  let sigE: number | number[] = isVec ? new Array<number>((f[0] as number[]).length).fill(0) : 0;
  let sigO: number | number[] = isVec ? new Array<number>((f[0] as number[]).length).fill(0) : 0;

  for (let j = 1; j <= k; j++) {
    if ((n + j) % 2 === 0) sigE = add(sigE, f[n + j], isVec);
    else                   sigO = add(sigO, f[n + j], isVec);
  }

  // Divide by the appropriate denominator.
  // Which denominator goes to which sigma depends on n's parity:
  //   n even: even (n+j) ↔ even j → denominator (n+1)(n+2)
  //           odd  (n+j) ↔ odd  j → denominator n(n+1)
  //   n odd:  even (n+j) ↔ odd  j → denominator n(n+1)
  //           odd  (n+j) ↔ even j → denominator (n+1)(n+2)
  const denomA = n * (n + 1);         // denominator for j-odd  terms
  const denomB = (n + 1) * (n + 2);  // denominator for j-even terms

  if (n % 2 === 0) {
    // σ_e holds even-j tail → denomB; σ_o holds odd-j tail → denomA
    sigE = scale(1 / denomB, sigE, isVec);
    sigO = scale(1 / denomA, sigO, isVec);
  } else {
    // σ_e holds odd-j tail → denomA; σ_o holds even-j tail → denomB
    sigE = scale(1 / denomA, sigE, isVec);
    sigO = scale(1 / denomB, sigO, isVec);
  }

  // Build output: g_i = f_i + (4i+2) × (σ_e if i even, σ_o if i odd)
  const g: (number | number[])[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const w = 4 * i + 2;
    g[i] = add(f[i], scale(w, i % 2 === 0 ? sigE : sigO, isVec), isVec);
  }
  return g;
}

// ---- tiny helpers ----------------------------------------------------------

function add(a: number | number[], b: number | number[], isVec: boolean): number | number[] {
  if (!isVec) return (a as number) + (b as number);
  return (a as number[]).map((v, i) => v + (b as number[])[i]);
}

function scale(s: number, v: number | number[], isVec: boolean): number | number[] {
  if (!isVec) return s * (v as number);
  return (v as number[]).map(x => s * x);
}
