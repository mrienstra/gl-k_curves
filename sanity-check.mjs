/**
 * Sanity checks — run with:  node sanity-check.mjs
 *
 * All results below are analytically verifiable by hand.
 */

import { legendreP, legendreAndDeriv, glNodes, glWeights } from './legendre.mjs';
import { gleveal } from './gleval.mjs';
import { applyAveraging } from './gl-averaging.mjs';
import { gl0LegendreCoeffs } from './gl0-legendre.mjs';
import { legendreReduce } from './legendrereduce.mjs';

let passed = 0, failed = 0;

function check(label, got, expected, tol = 1e-12) {
  const err = Math.abs(got - expected);
  if (err < tol) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.log(`  ✗  ${label}`);
    console.log(`       got ${got}, expected ${expected}, err ${err}`);
    failed++;
  }
}

function checkVec(label, got, expected, tol = 1e-12) {
  const err = Math.max(...got.map((v, i) => Math.abs(v - expected[i])));
  if (err < tol) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.log(`  ✗  ${label}`);
    console.log(`       got [${got}], expected [${expected}], maxErr ${err}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
console.log('\n── Legendre polynomials ──');

check('P_0(0.7) = 1',           legendreP(0, 0.7), 1);
check('P_1(0.7) = 0.7',         legendreP(1, 0.7), 0.7);
check('P_2(0.5) = (3*.25-1)/2', legendreP(2, 0.5), (3*0.25-1)/2);
check('P_3(0) = 0',             legendreP(3, 0),   0);
check('P_4(1) = 1',             legendreP(4, 1),   1);
check('P_4(-1) = 1',            legendreP(4, -1),  1);  // even degree

// ---------------------------------------------------------------------------
console.log('\n── GL nodes ──');

const n1 = glNodes(1);
check('glNodes(1)[0] = 0',       n1[0], 0);

const n2 = glNodes(2);
const r2 = Math.sqrt(1/3);
check('glNodes(2)[0] = -1/√3',  n2[0], -r2);
check('glNodes(2)[1] = +1/√3',  n2[1], +r2);

// Roots of P_3: 0, ±√(3/5)
const n3 = glNodes(3);
const r3 = Math.sqrt(3/5);
check('glNodes(3)[0] = -√(3/5)', n3[0], -r3);
check('glNodes(3)[1] = 0',       n3[1], 0, 1e-14);
check('glNodes(3)[2] = +√(3/5)', n3[2], +r3);

// All roots are roots of P_n
for (let n = 1; n <= 6; n++) {
  const nodes = glNodes(n);
  nodes.forEach((t, i) => {
    check(`P_${n}(τ_${i}) ≈ 0  (n=${n})`, legendreP(n, t), 0, 1e-12);
  });
}

// ---------------------------------------------------------------------------
console.log('\n── GL weights ──');

// Exact known values
// n=2: nodes ±1/√3, weights both = 1
{
  const w = glWeights(2);
  check('glWeights(2)[0] = 1', w[0], 1);
  check('glWeights(2)[1] = 1', w[1], 1);
}

// n=3: nodes ±√(3/5), 0; weights 5/9, 8/9, 5/9
{
  const w = glWeights(3);
  check('glWeights(3)[0] = 5/9', w[0], 5/9);
  check('glWeights(3)[1] = 8/9', w[1], 8/9);
  check('glWeights(3)[2] = 5/9', w[2], 5/9);
}

// Weights sum to 2 (∫_{-1}^{1} 1 dt = 2) for n = 1..6
for (let n = 1; n <= 6; n++) {
  const sum = glWeights(n).reduce((a, b) => a + b, 0);
  check(`Σ glWeights(${n}) = 2`, sum, 2, 1e-12);
}

// Symmetry: w_i = w_{n-1-i}
for (let n = 2; n <= 5; n++) {
  const w = glWeights(n);
  for (let i = 0; i < Math.floor(n / 2); i++) {
    check(`glWeights(${n}) symmetric: w[${i}]=w[${n-1-i}]`, w[i], w[n - 1 - i], 1e-14);
  }
}

// ---------------------------------------------------------------------------
console.log('\n── gl0LegendreCoeffs: straight line (scalar) ──');
// n=1, p=[0,1].  Legendre coeffs of (t+1)/2 are [1/2, 1/2].
{
  const c = gl0LegendreCoeffs([0, 1]);
  check('c[0] = 1/2', c[0], 0.5);
  check('c[1] = 1/2', c[1], 0.5);
  // gleveal at endpoints
  check('p(-1) = 0', gleveal(c, -1), 0);
  check('p( 1) = 1', gleveal(c,  1), 1);
}

// n=3, p=[0,0,0,1] — not a straight line, but p(-1)=0 and p(1)=1 should hold
{
  const pts = [0, 0, 0, 1];
  const c = gl0LegendreCoeffs(pts);
  check('p(-1)=0 (n=3)', gleveal(c, -1), 0, 1e-12);
  check('p( 1)=1 (n=3)', gleveal(c,  1), 1, 1e-12);
}

// ---------------------------------------------------------------------------
console.log('\n── gl0LegendreCoeffs: straight line (2D vector) ──');
{
  const pts = [[0,0],[1,2]];
  const c = gl0LegendreCoeffs(pts);
  checkVec('c[0] = [1/2, 1]', c[0], [0.5, 1]);
  checkVec('c[1] = [1/2, 1]', c[1], [0.5, 1]);
  checkVec('p(-1) = [0,0]', gleveal(c, -1), [0, 0]);
  checkVec('p( 1) = [1,2]', gleveal(c,  1), [1, 2]);
}

// ---------------------------------------------------------------------------
console.log('\n── Partition of unity ──');
// Sum of Legendre coeffs vector M_n·1 should be e_0 = [1,0,...,0]
// i.e., the GL-0 curve through a constant polygon is the constant.
for (let n = 1; n <= 5; n++) {
  const ones = Array.from({length: n+1}, () => 1);
  const c = gl0LegendreCoeffs(ones);
  check(`GL-0 of constant=1: c[0]=1 (n=${n})`, c[0], 1, 1e-12);
  for (let j = 1; j <= n; j++) {
    check(`GL-0 of constant=1: c[${j}]=0 (n=${n})`, c[j], 0, 1e-12);
  }
}

// ---------------------------------------------------------------------------
console.log('\n── Averaging ──');
{
  const pts = [0, 1];
  const p1  = applyAveraging(pts, 1);  // [0, 0.5, 1]
  check('p^1[0]=0',   p1[0], 0);
  check('p^1[1]=0.5', p1[1], 0.5);
  check('p^1[2]=1',   p1[2], 1);

  const p2 = applyAveraging(pts, 2);   // [0, 0.25, 0.5, 0.75, 1]? no:
  // step1: [0, 0.5, 1]
  // step2: [0, 0.25, 0.75, 1]
  check('p^2 has 4 pts', p2.length, 4);
  check('p^2[0]=0',    p2[0], 0);
  check('p^2[1]=0.25', p2[1], 0.25);
  check('p^2[2]=0.75', p2[2], 0.75);
  check('p^2[3]=1',    p2[3], 1);
}

// ---------------------------------------------------------------------------
console.log('\n── legendreReduce: straight line stays straight ──');
// GL-1 of [0,1]: average → [0, 0.5, 1], get degree-2 Legendre coeffs,
// reduce → should give [1/2, 1/2] (same as GL-0).
{
  const pts  = [0, 1];
  const p1   = applyAveraging(pts, 1);          // [0, 0.5, 1]
  const f    = gl0LegendreCoeffs(p1);           // degree-2 Legendre coeffs
  check('f[2] = 0 (collinear pts)', f[2], 0, 1e-12);
  const g    = legendreReduce(1, f);             // reduce to degree 1
  check('g[0] = 1/2', g[0], 0.5, 1e-12);
  check('g[1] = 1/2', g[1], 0.5, 1e-12);
}

// ---------------------------------------------------------------------------
console.log('\n── legendreReduce: verified s_{ij} cases ──');
// n=3 k=1: s_{0,1}=1/6, s_{2,1}=5/6, others 0
{
  const f = [0, 0, 0, 0, 1];  // only f[4] nonzero (n+j = 3+1 = 4, even → σ_e)
  const g = legendreReduce(1, f);
  check('n=3 k=1, i=0: g[0]=1/6', g[0], 1/6, 1e-14);
  check('n=3 k=1, i=1: g[1]=0',   g[1], 0,   1e-14);
  check('n=3 k=1, i=2: g[2]=5/6', g[2], 5/6, 1e-14);
  check('n=3 k=1, i=3: g[3]=0',   g[3], 0,   1e-14);
}

// n=3 k=2, j=2: s_{1,2}=3/10, s_{3,2}=7/10
{
  const f = [0, 0, 0, 0, 0, 1];  // only f[5] nonzero (n+j=3+2=5, odd → σ_o)
  const g = legendreReduce(2, f);
  check('n=3 k=2, i=0: g[0]=0',    g[0], 0,    1e-14);
  check('n=3 k=2, i=1: g[1]=3/10', g[1], 3/10, 1e-14);
  check('n=3 k=2, i=2: g[2]=0',    g[2], 0,    1e-14);
  check('n=3 k=2, i=3: g[3]=7/10', g[3], 7/10, 1e-14);
}

// ---------------------------------------------------------------------------
console.log(`\n── Summary: ${passed} passed, ${failed} failed ──\n`);
