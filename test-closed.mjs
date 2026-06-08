/**
 * Quantitative investigation of closed-curve period boundaries.
 *
 * Diamond shape: [275,525],[25,275],[275,25],[525,275],[275,525]
 * copies = 3, tile.length = 4, n_extended = 12
 *
 * We look at three candidate approaches for choosing [tStart, tEnd]:
 *   A. Old: equal cosine spacing → tStart = -cos(π * midCopy/copies)
 *   B. New: GL nodes of P_n at seam indices → nodes[midCopy*tileLen - 1]
 *   C. Symmetric: force midpoint of [tStart,tEnd] to be 0
 *      (use the average of nodes[k-1] and -nodes[copies*tileLen - k - 1])
 *
 * For each approach we evaluate curve(tStart) and curve(tEnd) for
 * GL-0, GL-1, GL-2 and print the gap (distance from p0 = [275,525]).
 */

import { glNodes }     from './legendre';
import { glkCoeffs }   from './glk-curve';
import { gleveal }     from './gleval';

// ── input ────────────────────────────────────────────────────────────────────
const pts   = [[275,525],[25,275],[275,25],[525,275],[275,525]];
const tile  = pts.slice(0, pts.length - 1);   // [p0,p1,p2,p3]
const copies = 3;

const extended = [];
for (let c = 0; c < copies; c++) for (const p of tile) extended.push(p);
extended.push(tile[0]);  // close: length = copies*tile.length + 1 = 13

const n   = extended.length - 1;   // 12
const p0  = tile[0];               // [275, 525] — the seam point

console.log(`tile.length = ${tile.length},  copies = ${copies}`);
console.log(`extended.length = ${extended.length},  n = ${n}`);
console.log(`seam point p0 = [${p0}]`);
console.log();

// ── GL nodes ─────────────────────────────────────────────────────────────────
const nodes = glNodes(n);   // 12 roots of P_12, sorted ascending

console.log('GL nodes of P_12 (roots of P_12, ascending):');
nodes.forEach((t, i) => console.log(`  τ_${i+1} = ${t.toFixed(9)}`));
console.log();

const midCopy = Math.floor(copies / 2);   // 1
// seam at control-point index k = midCopy * tile.length = 4
//   → node index k-1 = 3 (0-based)  (nodes array is 0-indexed)
// seam at control-point index k2 = (midCopy+1) * tile.length = 8
//   → node index k2-1 = 7
const seamIdx1 = midCopy * tile.length;         // 4  (index into extended[])
const seamIdx2 = (midCopy + 1) * tile.length;   // 8

console.log(`Seam control-point indices: ${seamIdx1} and ${seamIdx2}`);
console.log(`  extended[${seamIdx1}] = [${extended[seamIdx1]}]  (should be p0)`);
console.log(`  extended[${seamIdx2}] = [${extended[seamIdx2]}]  (should be p0)`);
console.log();

// ── approach A: old (equal cosine spacing) ───────────────────────────────────
const tStartA = -Math.cos(Math.PI * midCopy / copies);          // -cos(π/3) = -0.5
const tEndA   = -Math.cos(Math.PI * (midCopy + 1) / copies);   // -cos(2π/3) = +0.5
console.log('Approach A (old — equal cosine spacing):');
console.log(`  tStart = ${tStartA.toFixed(9)},  tEnd = ${tEndA.toFixed(9)}`);
console.log(`  midpoint = ${((tStartA+tEndA)/2).toFixed(9)},  half-width = ${((tEndA-tStartA)/2).toFixed(9)}`);
console.log();

// ── approach B: new (GL nodes at seam indices) ───────────────────────────────
const tStartB = nodes[seamIdx1 - 1];   // τ_4 (0-based index 3)
const tEndB   = nodes[seamIdx2 - 1];   // τ_8 (0-based index 7)
console.log('Approach B (new — GL nodes at seam indices):');
console.log(`  tStart = nodes[${seamIdx1-1}] = ${tStartB.toFixed(9)}`);
console.log(`  tEnd   = nodes[${seamIdx2-1}] = ${tEndB.toFixed(9)}`);
console.log(`  midpoint = ${((tStartB+tEndB)/2).toFixed(9)},  half-width = ${((tEndB-tStartB)/2).toFixed(9)}`);
console.log();

// ── approach C: symmetric (center on 0) ──────────────────────────────────────
// The nodes are symmetric: τ_i = -τ_{n+1-i}.
// For i = seamIdx1 (=4): symmetric partner is n+1-4 = 9 (1-based), i.e. nodes[8] = -nodes[3]
// Averaging: tStart = -(nodes[n - seamIdx2] + nodes[seamIdx1 - 1]) / 2 ...
// Actually the simplest symmetric choice: use the AVERAGE of tStartB and -tEndB as the
// half-width, centered at 0.
const halfWidthC = (Math.abs(tStartB) + Math.abs(tEndB)) / 2;
const tStartC = -halfWidthC;
const tEndC   =  halfWidthC;
console.log('Approach C (symmetric — center at 0, half-width = avg of |τ_4|, |τ_8|):');
console.log(`  tStart = ${tStartC.toFixed(9)},  tEnd = ${tEndC.toFixed(9)}`);
console.log(`  half-width = ${halfWidthC.toFixed(9)}`);
console.log();

// ── approach D: symmetric around midpoint of seam nodes ──────────────────────
// Use exactly the midpoint and half-range of [tStartB, tEndB], which is what the
// current code does (cMid ± cAmp * cos). Just report what it actually is:
const cMid = (tStartB + tEndB) / 2;
const cAmp = (tEndB - tStartB) / 2;
console.log('Approach D (current implementation — cosine-remapped over [tStartB, tEndB]):');
console.log(`  cMid = ${cMid.toFixed(9)},  cAmp = ${cAmp.toFixed(9)}`);
console.log(`  samples go from t=${(cMid-cAmp).toFixed(9)} to t=${(cMid+cAmp).toFixed(9)}`);
console.log(`  (same as approach B: start=tStartB, end=tEndB)`);
console.log();

// ── evaluate curves ───────────────────────────────────────────────────────────
function gap(pt) {
  const dx = pt[0] - p0[0], dy = pt[1] - p0[1];
  return Math.sqrt(dx*dx + dy*dy);
}
function fmt(pt) {
  return `[${pt[0].toFixed(3)}, ${pt[1].toFixed(3)}]`;
}
function fmtGap(pt) {
  const dx = pt[0] - p0[0], dy = pt[1] - p0[1];
  return `gap=[${dx.toFixed(3)}, ${dy.toFixed(3)}], dist=${gap(pt).toFixed(3)}`;
}

for (const k of [0, 1, 2]) {
  const coeffs = glkCoeffs(extended, k);
  console.log(`─── GL-${k} ──────────────────────────────────────────────────`);
  console.log(`  p0 (seam point)  = ${fmt(p0)}`);

  // Evaluate at the seam GL nodes (what a GL-0 curve should hit exactly)
  const atτ4 = gleveal(coeffs, tStartB);
  const atτ8 = gleveal(coeffs, tEndB);
  console.log(`  curve(τ_4=${tStartB.toFixed(5)}) = ${fmt(atτ4)},  ${fmtGap(atτ4)}`);
  console.log(`  curve(τ_8=${tEndB.toFixed(5)}) = ${fmt(atτ8)},  ${fmtGap(atτ8)}`);

  // Gap between the two seam evaluations
  const seamGapVec = [atτ8[0] - atτ4[0], atτ8[1] - atτ4[1]];
  const seamGapDist = Math.sqrt(seamGapVec[0]**2 + seamGapVec[1]**2);
  console.log(`  curve(τ_8) - curve(τ_4) = [${seamGapVec[0].toFixed(3)}, ${seamGapVec[1].toFixed(3)}],  dist=${seamGapDist.toFixed(3)}`);

  // Old approach: evaluate at ±0.5
  const atOldStart = gleveal(coeffs, tStartA);
  const atOldEnd   = gleveal(coeffs, tEndA);
  console.log(`  OLD: curve(${tStartA}) = ${fmt(atOldStart)},  ${fmtGap(atOldStart)}`);
  console.log(`  OLD: curve(${tEndA}) = ${fmt(atOldEnd)},  ${fmtGap(atOldEnd)}`);
  const oldGapVec = [atOldEnd[0] - atOldStart[0], atOldEnd[1] - atOldStart[1]];
  const oldGapDist = Math.sqrt(oldGapVec[0]**2 + oldGapVec[1]**2);
  console.log(`  OLD: gap dist = ${oldGapDist.toFixed(3)}`);

  // Symmetric approach: evaluate at ±halfWidthC
  const atSymStart = gleveal(coeffs, tStartC);
  const atSymEnd   = gleveal(coeffs, tEndC);
  const symGapVec = [atSymEnd[0] - atSymStart[0], atSymEnd[1] - atSymStart[1]];
  const symGapDist = Math.sqrt(symGapVec[0]**2 + symGapVec[1]**2);
  console.log(`  SYM: curve(${tStartC.toFixed(5)}) = ${fmt(atSymStart)},  ${fmtGap(atSymStart)}`);
  console.log(`  SYM: curve(${tEndC.toFixed(5)}) = ${fmt(atSymEnd)},  ${fmtGap(atSymEnd)}`);
  console.log(`  SYM: gap dist = ${symGapDist.toFixed(3)}`);

  console.log();
}

// ── what are the EXACT t values where curve(t) = p0 for GL-0? ────────────────
// For GL-0 this should be exactly τ_4 and τ_8 (up to floating point).
// Let's also scan around them to see if there's a nearby t with smaller gap.
console.log('─── Scan near τ_4 and τ_8 for GL-0 ───────────────────────────');
const coeffs0 = glkCoeffs(extended, 0);
for (const [label, tCenter] of [['τ_4', tStartB], ['τ_8', tEndB]]) {
  console.log(`Near ${label} = ${tCenter.toFixed(9)}:`);
  for (let delta = -0.01; delta <= 0.011; delta += 0.002) {
    const t = tCenter + delta;
    const pt = gleveal(coeffs0, t);
    console.log(`  t=${t.toFixed(7)}: ${fmt(pt)}, dist_from_p0=${gap(pt).toFixed(4)}`);
  }
}
console.log();

// ── scan the full curve to find where GL-0 is close to p0 ───────────────────
console.log('─── GL-0: scan full t in [-1,1] for proximity to p0 ───────────');
{
  const steps = 2000;
  let localMins = [];
  let prevDist = Infinity;
  let prevT = -1;
  for (let i = 0; i <= steps; i++) {
    const t = -1 + 2 * i / steps;
    const pt = gleveal(coeffs0, t);
    const d = gap(pt);
    // Collect points where dist < 50 pixels
    if (d < 50) {
      localMins.push({ t, pt, d });
    }
  }
  if (localMins.length === 0) {
    console.log('  No t in [-1,1] with GL-0 within 50 pixels of p0!');
    // Find the best overall
    let best = { t: 0, d: Infinity };
    for (let i = 0; i <= steps; i++) {
      const t = -1 + 2 * i / steps;
      const d = gap(gleveal(coeffs0, t));
      if (d < best.d) best = { t, d };
    }
    console.log(`  Closest: t=${best.t.toFixed(6)}, dist=${best.d.toFixed(3)}`);
  } else {
    console.log(`  ${localMins.length} points within 50px of p0:`);
    for (const { t, pt, d } of localMins.slice(0, 10)) {
      console.log(`  t=${t.toFixed(6)}: ${fmt(pt)}, dist=${d.toFixed(4)}`);
    }
    if (localMins.length > 10) console.log(`  ... (${localMins.length - 10} more)`);
  }
  // Always show exact endpoints
  console.log(`  t=-1: ${fmt(gleveal(coeffs0, -1))} (should be p0)`);
  console.log(`  t=+1: ${fmt(gleveal(coeffs0, +1))} (should be p0)`);
}
console.log();

// ── how does the seam gap scale with copies? ────────────────────────────────
console.log('─── Seam gap vs copies count (GL-0 and GL-1) ──────────────────');
for (const kk of [0, 1, 2]) {
  const coeffsK = glkCoeffs(extended, kk);
  console.log(`GL-${kk} with 3 copies:`);
  // Find the symmetric t that minimizes dist to p0 near the midcopy seam
  let bestT3 = -1/3, bestDist3 = Infinity;
  for (let dt = -0.5; dt <= 0; dt += 0.0001) {
    const t = dt;
    const d = gap(gleveal(coeffsK, t));
    if (d < bestDist3) { bestDist3 = d; bestT3 = t; }
  }
  const ptS = gleveal(coeffsK, bestT3);
  const ptE = gleveal(coeffsK, -bestT3);
  const seamGap3 = Math.sqrt((ptE[0]-ptS[0])**2 + (ptE[1]-ptS[1])**2);
  console.log(`  optimal t = ±${(-bestT3).toFixed(5)}, dist_from_p0=${bestDist3.toFixed(2)}, start-end gap=${seamGap3.toFixed(2)}`);
}
console.log();

for (const moreCopies of [5, 7, 9]) {
  let c = moreCopies;
  if (c % 2 === 0) c++;
  const ext2 = [];
  for (let cc = 0; cc < c; cc++) for (const p of tile) ext2.push(p);
  ext2.push(tile[0]);
  const n2 = ext2.length - 1;
  const mid2 = Math.floor(c / 2);

  for (const kk of [0, 1, 2]) {
    const coeffsK2 = glkCoeffs(ext2, kk);
    // Scan for best symmetric t
    let bestT = -mid2 / c, bestDist = Infinity;
    for (let dt = -0.4; dt <= 0; dt += 0.0002) {
      const t = dt;
      const d = gap(gleveal(coeffsK2, t));
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    const ptS = gleveal(coeffsK2, bestT);
    const ptE = gleveal(coeffsK2, -bestT);
    const gapDist = Math.sqrt((ptE[0]-ptS[0])**2 + (ptE[1]-ptS[1])**2);
    console.log(`copies=${c}, GL-${kk}: optimal t=±${(-bestT).toFixed(5)}, dist_from_p0=${bestDist.toFixed(2)}, start-end gap=${gapDist.toFixed(2)}`);
  }
  console.log();
}

// ── gap vs t for copies=3: sweep to find optimal per-k ──────────────────────
console.log('─── copies=3: gap(t) = dist(curve(-t), curve(t)) sweep ─────────');
console.log('  t        GL-0      GL-1      GL-2');
for (let t = 0.35; t <= 0.55; t += 0.01) {
  const gaps = [0, 1, 2].map(k => {
    const c = glkCoeffs(extended, k);
    const s = gleveal(c, -t), e = gleveal(c, t);
    return Math.sqrt((e[0]-s[0])**2 + (e[1]-s[1])**2);
  });
  const mark = gaps[0] < 5 || gaps[1] < 5 || gaps[2] < 5 ? ' ←' : '';
  console.log(`  t=${t.toFixed(3)}: ${gaps[0].toFixed(1).padStart(6)}  ${gaps[1].toFixed(1).padStart(6)}  ${gaps[2].toFixed(1).padStart(6)}${mark}`);
}
console.log();

// ── approach E: uniform linear parameterization ──────────────────────────────
// t = -1 + 2 * (seamIdx / n) — proportional to control-point index
const tStartE = -1 + 2 * seamIdx1 / n;   // -1 + 8/12 = -1/3
const tEndE   = -1 + 2 * seamIdx2 / n;   // -1 + 16/12 = +1/3
console.log('Approach E (uniform linear parameterization):');
console.log(`  tStart = -1 + 2*${seamIdx1}/${n} = ${tStartE.toFixed(9)}`);
console.log(`  tEnd   = -1 + 2*${seamIdx2}/${n} = ${tEndE.toFixed(9)}`);
console.log();

for (const k of [0, 1, 2]) {
  const coeffs = glkCoeffs(extended, k);
  const atE_start = gleveal(coeffs, tStartE);
  const atE_end   = gleveal(coeffs, tEndE);
  const gapVec = [atE_end[0]-atE_start[0], atE_end[1]-atE_start[1]];
  const gapDist = Math.sqrt(gapVec[0]**2+gapVec[1]**2);
  console.log(`  GL-${k}: curve(${tStartE.toFixed(5)})=${fmt(atE_start)} (${fmtGap(atE_start)})`);
  console.log(`  GL-${k}: curve(${tEndE.toFixed(5)})=${fmt(atE_end)} (${fmtGap(atE_end)})`);
  console.log(`  GL-${k}: gap dist = ${gapDist.toFixed(3)}`);
}
console.log();

// ── brute-force: find best t near each seam for all GL-k ─────────────────────
console.log('─── Best t near each seam for each GL-k (min dist to p0) ──────');
for (const k of [0, 1, 2]) {
  const coeffs = glkCoeffs(extended, k);
  for (const [label, tCenter] of [['seam1 (t≈'+tStartE.toFixed(3)+')', tStartE], ['seam2 (t≈'+tEndE.toFixed(3)+')', tEndE]]) {
    let bestT = tCenter, bestDist = Infinity;
    for (let dt = -0.3; dt <= 0.3; dt += 0.001) {
      const t = tCenter + dt;
      const d = gap(gleveal(coeffs, t));
      if (d < bestDist) { bestDist = d; bestT = t; }
    }
    const bestPt = gleveal(coeffs, bestT);
    console.log(`  GL-${k} near ${label}: best t=${bestT.toFixed(5)}, dist=${bestDist.toFixed(4)}, point=${fmt(bestPt)}`);
  }
  // Gap between best t values
}
console.log();

// ── approach F: for GL-0, find exact zeros (root-finding) ─────────────────────
// GL-0 of extended: the curve is a degree-12 polynomial in each component.
// The x-component passes through p0[0]=275 and y-component through p0[1]=525.
// We want t where both components equal p0 simultaneously.
// Root-find x-component: curve_x(t) = 275
console.log('─── GL-0 root finding: where does curve_x(t) = 275 OR curve_y(t) = 525? ─');
{
  const coeffs = glkCoeffs(extended, 0);
  // Scan for sign changes in (curve_x - 275)
  const xRoots = [], yRoots = [];
  let prevX = gleveal(coeffs, -1)[0] - p0[0];
  let prevY = gleveal(coeffs, -1)[1] - p0[1];
  const scan = 10000;
  for (let i = 1; i <= scan; i++) {
    const t = -1 + 2 * i / scan;
    const pt = gleveal(coeffs, t);
    const cx = pt[0] - p0[0];
    const cy = pt[1] - p0[1];
    if (prevX * cx < 0) xRoots.push(t - 1/scan);
    if (prevY * cy < 0) yRoots.push(t - 1/scan);
    prevX = cx; prevY = cy;
  }
  console.log(`  curve_x = 275 near t = ${xRoots.map(t=>t.toFixed(5)).join(', ')}`);
  console.log(`  curve_y = 525 near t = ${yRoots.map(t=>t.toFixed(5)).join(', ')}`);
  // Intersections: t values near both a x-root and y-root
  const both = xRoots.filter(tx => yRoots.some(ty => Math.abs(tx-ty) < 0.005));
  console.log(`  Near-simultaneous roots (both x=275, y=525): ${both.map(t=>t.toFixed(5)).join(', ')}`);
  // Refine near t=-1/3 and t=+1/3
  for (const tApprox of [tStartE, tEndE, tStartB, tEndB]) {
    // Bisection on total gap
    let tLow = tApprox - 0.1, tHigh = tApprox + 0.1;
    let dist = gap(gleveal(coeffs, tApprox));
    let bestT = tApprox;
    for (let iter = 0; iter < 50; iter++) {
      const tMid = (tLow + tHigh) / 2;
      const dL = gap(gleveal(coeffs, tMid - 0.0001));
      const dR = gap(gleveal(coeffs, tMid + 0.0001));
      if (dL < dR) tHigh = tMid; else tLow = tMid;
    }
    const tBest = (tLow + tHigh) / 2;
    const ptBest = gleveal(coeffs, tBest);
    console.log(`  GL-0 min near t=${tApprox.toFixed(4)}: t=${tBest.toFixed(7)}, point=${fmt(ptBest)}, dist=${gap(ptBest).toFixed(4)}`);
  }
}
