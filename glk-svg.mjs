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
// Chain detection
// ---------------------------------------------------------------------------

/**
 * Group consecutive segments that share an endpoint into chains.
 * Segments[s] and segments[s+1] are chained when the last point of s equals
 * the first point of s+1 (exact coordinate match, as produced by "split").
 *
 * Returns an array of chains, each chain being an array of indices into segs.
 */
function buildChains(segs) {
  if (segs.length === 0) return [];
  const chains = [[0]];
  for (let s = 1; s < segs.length; s++) {
    const tail  = segs[s - 1][segs[s - 1].length - 1];
    const head  = segs[s][0];
    if (tail[0] === head[0] && tail[1] === head[1])
      chains[chains.length - 1].push(s);
    else
      chains.push([s]);
  }
  return chains;
}

// ---------------------------------------------------------------------------
// Full SVG document builder
// ---------------------------------------------------------------------------

/**
 * Build a complete SVG document mirroring the current editor canvas.
 *
 * Consecutive segments that share an endpoint (e.g. produced by "split") are
 * merged into a single SVG <path> element per curve type so that the join is
 * rendered with a proper stroke-linejoin rather than two separate stroke caps.
 *
 * @param {Array}  segments - array of control-point arrays  [[x,y], …]
 * @param {Object} opts     - mirrors the editor's checkboxes / sliders:
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
    showM1  = false,
    showFrac = false, showFracMod = false,
    showPoly = false,
    kFrac = 1, eta = null, alpha = 1,
    M = 8,
    styles = {},
  } = opts;

  const { color: gl0Color = '#f97',  width: gl0Width = 2,   dash: gl0Dash    = []     } = styles.gl0    ?? {};
  const { color: gl1Color = '#7bf',  width: gl1Width = 2,   dash: gl1Dash    = []     } = styles.gl1    ?? {};
  const { color: gl2Color = '#8f8',  width: gl2Width = 2,   dash: gl2Dash    = []     } = styles.gl2    ?? {};
  const { color: modGl1Color = '#fc6', width: modGl1Width = 2.5, dash: modGl1Dash = [] } = styles.modGl1 ?? {};
  const { color: fracColor = '#fff', width: fracWidth = 1.5, dash: fracDash   = [8, 3] } = styles.frac   ?? {};

  // Format parameter values for <title> text
  const etaStr   = eta   === null ? 'auto' : eta.toFixed(2);
  const alphaStr = alpha.toFixed(2);
  const kStr     = kFrac.toFixed(2);

  // Collect path elements per named group.
  // Each group: { id, title, paths: string[] }
  const groups = [];

  function getGroup(id, title) {
    let g = groups.find(g => g.id === id);
    if (!g) { g = { id, title, paths: [] }; groups.push(g); }
    return g;
  }

  // Work only with valid segments (≥2 points)
  const valid = segments.filter(s => s.length >= 2);
  const chains = buildChains(valid);

  // Per-segment helper: resolve eta and segM
  function segInfo(pts) {
    const n = pts.length - 1;
    let e1 = eta, e2 = eta;
    if (e1 === null || e2 === null) {
      const w0 = glWeights(n)[0];
      if (e1 === null) e1 = 1 / w0;
      if (e2 === null) e2 = 1 / w0;
    }
    return { n, e1, e2, segM: Math.max(M, n) };
  }

  // Build merged path data for a chain given a per-segment matrix factory.
  // matrixFn(pts, info) → matrix | null  (null = skip this curve type for segment)
  // Returns null if any segment in the chain is skipped.
  function chainPathD(chain, matrixFn) {
    let d = '';
    for (let ci = 0; ci < chain.length; ci++) {
      const pts  = valid[chain[ci]];
      const info = segInfo(pts);
      const L    = matrixFn(pts, info);
      if (!L) return null;
      const coeffs = applyMatrix(L, pts);
      const segD   = coeffsToSVGPath(coeffs, info.segM);
      // For segments after the first: strip the "M x,y " prefix — the current
      // point in the SVG path is already at that coordinate (end of previous C).
      d += ci === 0 ? segD : ' ' + segD.replace(/^M \S+ /, '');
    }
    return d;
  }

  function addChainPath(chain, matrixFn, groupId, groupTitle, stroke, sw, dashArray = null) {
    const d = chainPathD(chain, matrixFn);
    if (!d) return;
    const da = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
    getGroup(groupId, groupTitle).paths.push(
      `    <path d="${d}" stroke="${stroke}" fill="none" stroke-width="${sw}"${da}/>`
    );
  }

  for (const chain of chains) {
    if (showPoly) {
      // Polygon: one polyline per segment (dashed lines between separate segments
      // would be misleading, so keep them independent).
      for (const si of chain) {
        const pts   = valid[si];
        const ptStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        getGroup('polygon', 'Control polygon').paths.push(
          `    <polyline points="${ptStr}" stroke="#555" fill="none" stroke-width="1" stroke-dasharray="4 4"/>`
        );
      }
    }

    if (showGL0)
      addChainPath(chain, (pts, {n}) => buildGLKMatrix(n, 0),
        'gl-0', 'GL-0', gl0Color, gl0Width,
        gl0Dash.length ? gl0Dash.join(' ') : null);
    if (showGL1)
      addChainPath(chain, (pts, {n}) => buildGLKMatrix(n, 1),
        'gl-1', 'GL-1', gl1Color, gl1Width,
        gl1Dash.length ? gl1Dash.join(' ') : null);
    if (showGL2)
      addChainPath(chain, (pts, {n}) => n >= 2 ? buildGLKMatrix(n, 2) : null,
        'gl-2', 'GL-2', gl2Color, gl2Width,
        gl2Dash.length ? gl2Dash.join(' ') : null);

    if (showM1)
      addChainPath(chain, (pts, {n, e1, e2}) => n >= 3 ? buildModifiedGLKMatrix(n, 1, e1, e2, alpha) : null,
        'mod-gl-1', `mod GL-1  η=${etaStr}  α=${alphaStr}`, modGl1Color, modGl1Width,
        modGl1Dash.length ? modGl1Dash.join(' ') : null);

    if (showFrac) {
      const isMod  = showFracMod;
      const title  = isMod
        ? `GL-k (fractional, mod)  k=${kStr}  η=${etaStr}  α=${alphaStr}`
        : `GL-k (fractional)  k=${kStr}`;
      addChainPath(chain, (pts, {n, e1, e2}) => {
        const Lf = buildGLKMatrixFractional(n, kFrac);
        return (isMod && n >= 3) ? applyTangentOperator(n, Lf, e1, e2, alpha) : Lf;
      }, `frac-k${kStr}`, title, fracColor, fracWidth,
        fracDash.length ? fracDash.join(' ') : null);
    }
  }

  // Control points (collected across all segments into one group)
  if (showPoly) {
    const cpPaths = [];
    for (const pts of valid)
      for (const [x, y] of pts)
        cpPaths.push(`    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#666"/>`);
    if (cpPaths.length)
      getGroup('control-points', 'Control points').paths.push(...cpPaths);
  }

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
