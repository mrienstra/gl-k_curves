import { buildGLKMatrix } from './glk-matrix';
import { gleveal }        from './gleval';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx    = canvas.getContext('2d') as CanvasRenderingContext2D;

// ── sizing ──────────────────────────────────────────────────────────────────
function resize() {
  canvas.width  = window.innerWidth - 200;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);

// ── compute basis functions ─────────────────────────────────────────────────
// Returns (n+1) arrays, each of length nSamples: cols[i][s] = C_i^k(t_s).
function computeBasis(n: number, k: number, nSamples = 600): number[][] {
  const L = buildGLKMatrix(n, k);

  // Extract all columns once — cols[i] = Legendre coefficients of C_i^k
  const cols = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => L[j][i])
  );

  // Evaluate each basis function at all sample points
  return cols.map(col =>
    Array.from({ length: nSamples }, (_, s) => {
      const t = -1 + 2 * s / (nSamples - 1);
      return gleveal(col, t);
    })
  );
  // returns (n+1) × nSamples
}

// ── color per basis index ───────────────────────────────────────────────────
function basisColor(i: number, n: number): string {
  const hue = Math.round(360 * i / (n + 1));
  return `hsl(${hue}, 75%, 62%)`;
}

// ── draw ────────────────────────────────────────────────────────────────────
function draw() {
  const n = parseInt((document.getElementById('selN') as HTMLSelectElement).value);
  const k = parseInt((document.getElementById('selK') as HTMLSelectElement).value);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const ML = 50, MR = 80, MT = 30;
  // Reserve bottom margin for the key (estimate rows needed)
  const entryWEst = 18 + 6 + 22 + 10;
  const perRowEst = Math.max(1, Math.floor((canvas.width - ML - MR) / entryWEst));
  const keyRows   = Math.ceil((n + 1) / perRowEst);
  const MB        = 44 + (keyRows - 1) * 16;
  const W = canvas.width  - ML - MR;
  const H = canvas.height - MT - MB;

  // Fixed y range: show [-0.2, 1.15] to accommodate negatives + top margin
  const yLo = -0.22, yHi = 1.15;

  function tx(t: number)   { return ML + (t + 1) / 2 * W; }
  function ty(val: number) { return MT + (1 - (val - yLo) / (yHi - yLo)) * H; }

  // ── grid & axes ──────────────────────────────────────────────────────────
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = 1;

  // Horizontal grid lines at y = -0.1, 0, 0.25, 0.5, 0.75, 1.0
  for (const v of [-0.1, 0, 0.25, 0.5, 0.75, 1.0]) {
    const yc = ty(v);
    ctx.beginPath();
    ctx.moveTo(ML, yc);
    ctx.lineTo(ML + W, yc);
    if (v === 0 || v === 1.0) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth   = 1.5;
    } else {
      ctx.strokeStyle = '#2e2e2e';
      ctx.lineWidth   = 1;
    }
    ctx.stroke();
  }

  // Partition of unity line (y = 1), dashed
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#666';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(ML, ty(1));
  ctx.lineTo(ML + W, ty(1));
  ctx.stroke();
  ctx.restore();

  // Vertical axis ticks at t = -1, -0.5, 0, 0.5, 1
  ctx.fillStyle  = '#666';
  ctx.font       = '11px monospace';
  ctx.textAlign  = 'center';
  for (const tv of [-1, -0.5, 0, 0.5, 1]) {
    const xc = tx(tv);
    ctx.beginPath();
    ctx.moveTo(xc, MT + H);
    ctx.lineTo(xc, MT + H + 4);
    ctx.strokeStyle = '#555';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillText(tv.toFixed(1), xc, MT + H + 16);
  }

  // y-axis labels
  ctx.textAlign = 'right';
  for (const v of [0, 0.5, 1.0]) {
    ctx.fillText(v.toFixed(1), ML - 6, ty(v) + 4);
  }

  // Axis label
  ctx.textAlign  = 'center';
  ctx.fillStyle  = '#555';
  ctx.fillText('t', ML + W / 2, MT + H + 32);

  // Title
  ctx.fillStyle = '#aaa';
  ctx.font      = '13px monospace';
  ctx.fillText(`C_i^${k}(t),  n = ${n}`, ML + W / 2, MT - 10);

  // ── basis curves ─────────────────────────────────────────────────────────
  const table = computeBasis(n, k);        // (n+1) × nSamples
  const nSamples = table[0].length;
  let globalMin = Infinity;

  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    for (let s = 0; s < nSamples; s++) {
      const val = table[i][s];
      if (val < globalMin) globalMin = val;
      const xc = tx(-1 + 2 * s / (nSamples - 1));
      const yc = ty(val);
      s === 0 ? ctx.moveTo(xc, yc) : ctx.lineTo(xc, yc);
    }
    ctx.strokeStyle = basisColor(i, n);
    ctx.lineWidth   = 1.8;
    ctx.stroke();
  }

  // ── bottom key ────────────────────────────────────────────────────────────
  // Each entry: coloured dash + "Cᵢ". Wrap if too many to fit on one line.
  ctx.font      = '11px monospace';
  ctx.textAlign = 'left';
  const swatchW = 18, gap = 6, labelW = 22, entryW = entryWEst;
  const keyY    = MT + H + 32;
  const perRow  = perRowEst;
  for (let i = 0; i <= n; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const xc  = ML + col * entryW;
    const yc  = keyY + row * 16;
    ctx.strokeStyle = basisColor(i, n);
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(xc, yc - 3);
    ctx.lineTo(xc + swatchW, yc - 3);
    ctx.stroke();
    ctx.fillStyle = basisColor(i, n);
    ctx.fillText(`C${i}`, xc + swatchW + gap, yc);
  }

  // ── min value label ──────────────────────────────────────────────────────
  document.getElementById('minVal')!.textContent =
    `min C_i^${k} ≈ ${globalMin.toFixed(4)}`;
}

// ── controls ────────────────────────────────────────────────────────────────
document.getElementById('selN')!.addEventListener('change', draw);
document.getElementById('selK')!.addEventListener('change', draw);

resize();
