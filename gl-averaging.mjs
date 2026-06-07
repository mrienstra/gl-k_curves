/**
 * GL-k averaging operator (Section 4 of the paper).
 *
 * One step maps m control points → m+1 control points:
 *
 *   q_0   = p_0                             (first endpoint kept)
 *   q_i   = (p_{i-1} + p_i) / 2,  i=1..m-1  (midpoints)
 *   q_m   = p_{m-1}                          (last endpoint kept)
 *
 * After k steps a polygon of n+1 points becomes one of n+k+1 points.
 * Points may be scalars or equal-length arrays.
 */

/** One averaging step: m points → m+1 points. */
export function averageStep(pts) {
  const m = pts.length;
  const out = new Array(m + 1);
  out[0] = pts[0];
  for (let i = 1; i < m; i++) {
    out[i] = mid(pts[i - 1], pts[i]);
  }
  out[m] = pts[m - 1];
  return out;
}

/** Apply k averaging steps to a polygon. k=0 returns pts unchanged. */
export function applyAveraging(pts, k) {
  let cur = pts;
  for (let i = 0; i < k; i++) cur = averageStep(cur);
  return cur;
}

// ---- midpoint helper (works for scalars and numeric arrays) ----------------

function mid(a, b) {
  if (Array.isArray(a)) return a.map((v, i) => (v + b[i]) * 0.5);
  return (a + b) * 0.5;
}
