/**
 * SVG export for GL-k curves using Hermite cubic Bézier approximation.
 *
 * Each curve (degree-n polynomial in the Legendre basis) is split into M
 * sub-intervals of [-1, 1].  On each sub-interval a cubic Bézier is fitted
 * to match position and tangent at both endpoints (Hermite interpolation):
 *
 *   P0 = p(a)
 *   P1 = p(a) + h/3 · p'(a)     h = b − a
 *   P2 = p(b) − h/3 · p'(b)
 *   P3 = p(b)
 *
 * For degree ≤ 3 a single segment (M=1) is exact.
 * M=8 is visually indistinguishable from exact at any practical resolution.
 */

import { gleveal }                     from './gleval.mjs';
import { buildGLKMatrix, applyMatrix } from './glk-matrix.mjs';
import { buildModifiedGLKMatrix,
         applyTangentOperator }        from './glk-modified.mjs';
import { buildGLKMatrixFractional }    from './glk-fractional.mjs';
import { glWeights }                   from './legendre.mjs';

// ---------------------------------------------------------------------------
// Legendre series differentiation
// ---------------------------------------------------------------------------

/**
 * Given Legendre coefficients c[0..n] of f(t), return coefficients d[0..n-1]
 * of f'(t), using the recurrence:
 *
 *   d[i] = (2i+1) · Σ_{j = i+1, i+3, …, ≤n} c[j]
 *
 * Works for both scalar and 2D-vector (e.g. [x, y]) coefficients.
 * Returns an empty array when coeffs has length 1 (constant series).
 */
export function legDerivCoeffs(coeffs) {
  const n = coeffs.length - 1;
  const isVec = Array.isArray(coeffs[0]);
  const d = [];
  for (let i = 0; i < n; i++) {
    const w = 2 * i + 1;
    if (isVec) {
      const dim = coeffs[0].length;
      const s = new Array(dim).fill(0);
      for (let j = i + 1; j <= n; j += 2)
        for (let k = 0; k < dim; k++) s[k] += coeffs[j][k];
      d.push(s.map(v => w * v));
    } else {
      let s = 0;
      for (let j = i + 1; j <= n; j += 2) s += coeffs[j];
      d.push(w * s);
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// Hermite cubic Bézier path builder
// ---------------------------------------------------------------------------

/**
 * Convert 2D Legendre coefficients to an SVG cubic Bézier path string.
 *
 * @param {Array}  coeffs - array of [x, y] Legendre coefficients
 * @param {number} M      - number of Hermite cubic segments (default 8)
 * @returns {string}      - SVG path data "M x,y C x,y x,y x,y C …"
 */
export function coeffsToSVGPath(coeffs, M = 8) {
  const dc = legDerivCoeffs(coeffs);
  const zero = [0, 0];
  const deriv = (t) => dc.length > 0 ? gleveal(dc, t) : zero;

  let d = '';
  for (let m = 0; m < M; m++) {
    const a = -Math.cos(Math.PI * m / M);
    const b = -Math.cos(Math.PI * (m + 1) / M);
    const h = b - a;

    const p0  = gleveal(coeffs, a);
    const dp0 = deriv(a);
    const p3  = gleveal(coeffs, b);
    const dp3 = deriv(b);

    const p1 = [p0[0] + h / 3 * dp0[0], p0[1] + h / 3 * dp0[1]];
    const p2 = [p3[0] - h / 3 * dp3[0], p3[1] - h / 3 * dp3[1]];

    const f = v => v.toFixed(3);
    if (m === 0) d += `M ${f(p0[0])},${f(p0[1])}`;
    d += ` C ${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])} ${f(p3[0])},${f(p3[1])}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Full SVG document builder
// ---------------------------------------------------------------------------

/**
 * Build a complete SVG document mirroring the current demo canvas.
 *
 * @param {Array}  segments - array of control-point arrays  [[x,y], …]
 * @param {Object} opts     - mirrors the demo's checkboxes / sliders:
 *   width, height          canvas size
 *   showGL0/1/2            integer GL-k curves
 *   showM0/M1              modified GL-k curves
 *   showFrac / showFracMod fractional GL-k (and its mod variant)
 *   showPoly               control polygon
 *   kFrac                  fractional k value
 *   eta                    η (null = paper default 1/ω₀)
 *   alpha                  mod blend (0 = no mod, 1 = full mod)
 *   M                      Hermite segments per curve (default 8)
 * @returns {string}        complete SVG text
 */
export function buildSVG(segments, opts = {}) {
  const {
    width, height,
    showGL0 = false, showGL1 = false, showGL2 = false,
    showM0  = false, showM1  = false,
    showFrac = false, showFracMod = false,
    showPoly = false,
    kFrac = 1, eta = null, alpha = 1,
    M = 8,
  } = opts;

  // Format parameter values for <title> text
  const etaStr   = eta   === null ? 'auto' : eta.toFixed(2);
  const alphaStr = alpha.toFixed(2);
  const kStr     = kFrac.toFixed(2);

  // Collect path elements per named group.
  // Each group: { id, title, paths: string[] }
  const groups = [];

  // Helper: create or reuse a group bucket
  function getGroup(id, title) {
    let g = groups.find(g => g.id === id);
    if (!g) { g = { id, title, paths: [] }; groups.push(g); }
    return g;
  }

  for (const pts of segments) {
    if (pts.length < 2) continue;
    const n = pts.length - 1;

    // Resolve eta (depends on n via glWeights)
    let e1 = eta, e2 = eta;
    if (e1 === null || e2 === null) {
      const w0 = glWeights(n)[0];
      if (e1 === null) e1 = 1 / w0;
      if (e2 === null) e2 = 1 / w0;
    }

    // Scale Hermite segments with polynomial degree so endpoint accuracy holds.
    const segM = Math.max(M, n);

    // Helper: matrix → path string
    const pathStr = (L, stroke, sw, dashArray = null) => {
      const coeffs = applyMatrix(L, pts);
      const d = coeffsToSVGPath(coeffs, segM);
      const da = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
      return `    <path d="${d}" stroke="${stroke}" fill="none" stroke-width="${sw}"${da}/>`;
    };

    if (showPoly) {
      const ptStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      getGroup('polygon', 'Control polygon')
        .paths.push(`    <polyline points="${ptStr}" stroke="#555" fill="none" stroke-width="1" stroke-dasharray="4 4"/>`);
    }

    if (showGL0)
      getGroup('gl-0', 'GL-0')
        .paths.push(pathStr(buildGLKMatrix(n, 0), '#f97', 2));
    if (showGL1)
      getGroup('gl-1', 'GL-1')
        .paths.push(pathStr(buildGLKMatrix(n, 1), '#7bf', 2));
    if (showGL2 && n >= 2)
      getGroup('gl-2', 'GL-2')
        .paths.push(pathStr(buildGLKMatrix(n, 2), '#8f8', 2));

    if (n >= 3) {
      if (showM0)
        getGroup('mod-gl-0', `mod GL-0  η=${etaStr}  α=${alphaStr}`)
          .paths.push(pathStr(buildModifiedGLKMatrix(n, 0, e1, e2, alpha), '#f5c', 2));
      if (showM1)
        getGroup('mod-gl-1', `mod GL-1  η=${etaStr}  α=${alphaStr}`)
          .paths.push(pathStr(buildModifiedGLKMatrix(n, 1, e1, e2, alpha), '#fc6', 2.5));
    }

    if (showFrac) {
      const Lf     = buildGLKMatrixFractional(n, kFrac);
      const isMod  = showFracMod && n >= 3;
      const Luse   = isMod ? applyTangentOperator(n, Lf, e1, e2, alpha) : Lf;
      const title  = isMod
        ? `GL-k (fractional, mod)  k=${kStr}  η=${etaStr}  α=${alphaStr}`
        : `GL-k (fractional)  k=${kStr}`;
      getGroup(`frac-k${kStr}`, title)
        .paths.push(pathStr(Luse, '#fff', 1.5, '8 3'));
    }
  }

  // Control points (collected across all segments into one group)
  const cpPaths = [];
  for (const pts of segments)
    for (const [x, y] of pts)
      cpPaths.push(`    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#666"/>`);
  if (cpPaths.length)
    getGroup('control-points', 'Control points').paths.push(...cpPaths);

  // Render
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`,
    `     style="background:#1a1a1a">`,
  ];
  for (const { id, title, paths } of groups) {
    lines.push(`  <g id="${id}">`);
    lines.push(`    <title>${title}</title>`);
    lines.push(...paths);
    lines.push(`  </g>`);
  }
  lines.push('</svg>');
  return lines.join('\n');
}
