import { sampleGLK }             from './glk-curve.mjs';
import { sampleModifiedGLK }     from './glk-modified.mjs';
import { sampleGLKFractional, sampleModifiedGLKFractional } from './glk-fractional.mjs';
import { buildSVG }              from './glk-svg.mjs';
import { svgFileToSegments }     from './svg-path-import.mjs';

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

// ── state ──────────────────────────────────────────────────────────────────
let segments = [
  [[120, 350], [200, 100], [320, 280], [440, 80], [560, 300], [660, 140]],
];
let activeSeg = 0;
let drag = null;       // { s: segIndex, i: ptIndex } or null
let selected = null;   // { s: segIndex, i: ptIndex } or null — persists after mouseup
let mouseDownPos = null;

// ── sizing ─────────────────────────────────────────────────────────────────
function resize() {
  const dpr          = window.devicePixelRatio || 1;
  const previewOn    = document.getElementById('chkSVGPreview').checked;
  const totalW       = window.innerWidth - 200;
  const w            = previewOn ? Math.floor(totalW / 2) : totalW;
  const h            = window.innerHeight;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);
  draw();
}
window.addEventListener('resize', resize);

// ── drawing ────────────────────────────────────────────────────────────────
function drawCurve(samples, color, width = 2) {
  if (samples.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(samples[0][0], samples[0][1]);
  for (let i = 1; i < samples.length; i++) ctx.lineTo(samples[i][0], samples[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.stroke();
}

function drawPolygon(pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = '#555';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoints(pts, isActive, selectedIdx = -1) {
  for (let i = 0; i < pts.length; i++) {
    const isSel = i === selectedIdx;
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], isActive ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? '#0ff'
      : isActive ? (i === 0 || i === pts.length - 1 ? '#fa6' : '#aaa')
      : '#666';
    ctx.fill();
    if (isActive || isSel) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();
    }
  }
}

function updateSVGPreview() {
  const previewEl = document.getElementById('svgPreview');
  if (previewEl.style.display === 'none') return;
  const rawEta = parseFloat(document.getElementById('sldEta').value);
  const svg = buildSVG(segments, {
    width:       canvas.clientWidth,
    height:      canvas.clientHeight,
    showGL0:     document.getElementById('chk0').checked,
    showGL1:     document.getElementById('chk1').checked,
    showGL2:     document.getElementById('chk2').checked,
    showM0:      document.getElementById('chkM0').checked,
    showM1:      document.getElementById('chkM1').checked,
    showFrac:    document.getElementById('chkFrac').checked,
    showFracMod: document.getElementById('chkFracMod').checked,
    showPoly:    document.getElementById('chkPoly').checked,
    kFrac:       parseFloat(document.getElementById('sldK').value),
    eta:         rawEta === 0 ? null : rawEta,
    alpha:       parseFloat(document.getElementById('sldAlpha').value),
  });
  previewEl.innerHTML = svg;
  const svgEl = previewEl.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const anyPoints = segments.some(s => s.length > 0);
  if (!anyPoints) {
    ctx.fillStyle = '#555';
    ctx.fillText('Click to add control points', 20, 40);
  }

  const N    = 300;
  const kFrac = parseFloat(document.getElementById('sldK').value);
  document.getElementById('kVal').textContent = kFrac.toFixed(2);
  const raw = parseFloat(document.getElementById('sldEta').value);
  const eta = raw === 0 ? null : raw;   // 0 → paper default (null = 1/ω₀)
  document.getElementById('etaVal').textContent = eta === null ? 'auto' : raw.toFixed(1);
  const alpha = parseFloat(document.getElementById('sldAlpha').value);
  document.getElementById('alphaVal').textContent = alpha.toFixed(2);

  for (let s = 0; s < segments.length; s++) {
    const pts = segments[s];
    if (pts.length < 2) continue;

    if (document.getElementById('chkPoly').checked) drawPolygon(pts);

    try {
      if (document.getElementById('chk0').checked)
        drawCurve(sampleGLK(pts, 0, N), '#f97');
      if (document.getElementById('chk1').checked && pts.length >= 2)
        drawCurve(sampleGLK(pts, 1, N), '#7bf');
      if (document.getElementById('chk2').checked && pts.length >= 3)
        drawCurve(sampleGLK(pts, 2, N), '#8f8');
      if (document.getElementById('chkFrac').checked && pts.length >= 2) {
        ctx.setLineDash([8, 3]);
        const fracSampler = document.getElementById('chkFracMod').checked && pts.length >= 4
          ? sampleModifiedGLKFractional(pts, kFrac, N, eta, eta, alpha)
          : sampleGLKFractional(pts, kFrac, N);
        drawCurve(fracSampler, '#fff', 1.5);
        ctx.setLineDash([]);
      }
      if (document.getElementById('chkM0').checked && pts.length >= 4)
        drawCurve(sampleModifiedGLK(pts, 0, N, eta, eta, alpha), '#f5c', 2);
      if (document.getElementById('chkM1').checked && pts.length >= 4)
        drawCurve(sampleModifiedGLK(pts, 1, N, eta, eta, alpha), '#fc6', 2.5);
    } catch (e) {
      ctx.fillStyle = '#f66';
      ctx.fillText(e.message, 10, 20);
    }
  }

  if (document.getElementById('chkPoly').checked)
    for (let s = 0; s < segments.length; s++) {
      const selIdx = (selected && selected.s === s) ? selected.i : -1;
      drawPoints(segments[s], s === activeSeg, selIdx);
    }

  document.getElementById('segInfo').textContent =
    `Seg ${activeSeg + 1} / ${segments.length}`;
  updateSVGPreview();
}

// ── interaction ────────────────────────────────────────────────────────────
function nearestPoint(x, y, radius = 12) {
  let best = null, bestD = Infinity;
  for (let s = 0; s < segments.length; s++) {
    for (let i = 0; i < segments[s].length; i++) {
      const d = Math.hypot(segments[s][i][0] - x, segments[s][i][1] - y);
      if (d < radius && d < bestD) { best = { s, i }; bestD = d; }
    }
  }
  return best;
}

canvas.addEventListener('mousedown', e => {
  const x = e.offsetX, y = e.offsetY;
  const hit = nearestPoint(x, y);
  mouseDownPos = { x, y };
  if (hit) { drag = hit; activeSeg = hit.s; draw(); return; }
  selected = null;
  segments[activeSeg].push([x, y]);
  draw();
});

canvas.addEventListener('mousemove', e => {
  if (!drag) return;
  segments[drag.s][drag.i] = [e.offsetX, e.offsetY];
  draw();
});

canvas.addEventListener('mouseup', e => {
  if (drag && mouseDownPos) {
    const dist = Math.hypot(e.offsetX - mouseDownPos.x, e.offsetY - mouseDownPos.y);
    if (dist < 5) {
      // click (not drag) — toggle selection
      selected = (selected && selected.s === drag.s && selected.i === drag.i) ? null : drag;
      draw();
    }
  }
  drag = null;
  mouseDownPos = null;
});

canvas.addEventListener('dblclick', e => {
  const hit = nearestPoint(e.offsetX, e.offsetY);
  if (!hit) return;
  if (selected && selected.s === hit.s && selected.i === hit.i) selected = null;
  segments[hit.s].splice(hit.i, 1);
  // Prune empty segments, but always keep at least one
  if (segments[hit.s].length === 0 && segments.length > 1) {
    segments.splice(hit.s, 1);
    activeSeg = Math.min(activeSeg, segments.length - 1);
  }
  draw();
});

document.getElementById('btnSplit').addEventListener('click', () => {
  if (!selected) return;
  const { s, i } = selected;
  const pts = segments[s];
  if (i === 0 || i === pts.length - 1) return; // endpoint — nothing to split
  segments.splice(s, 1, pts.slice(0, i + 1), pts.slice(i));
  activeSeg = s + 1;
  selected = null;
  draw();
});

document.getElementById('btnNewSeg').addEventListener('click', () => {
  segments.push([]);
  activeSeg = segments.length - 1;
  draw();
});

document.getElementById('btnClear').addEventListener('click', () => {
  if (segments.length > 1) {
    segments.splice(activeSeg, 1);
    activeSeg = Math.min(activeSeg, segments.length - 1);
  } else {
    segments[0] = [];
  }
  draw();
});

document.getElementById('btnReset').addEventListener('click', () => {
  segments = [
    [[120, 350], [200, 100], [320, 280], [440, 80], [560, 300], [660, 140]],
  ];
  activeSeg = 0;
  draw();
});

document.getElementById('btnCopy').addEventListener('click', () => {
  const rounded = segments.map(seg => seg.map(([x, y]) => [Math.round(x), Math.round(y)]));
  const raw = parseFloat(document.getElementById('sldEta').value);
  // Include eta only when non-default; use plain array format when no eta
  const payload = raw === 0
    ? rounded
    : { segments: rounded, eta: raw };
  const json = JSON.stringify(payload);
  navigator.clipboard.writeText(json).catch(() => prompt('Copy this JSON:', json));
});

document.getElementById('btnPaste').addEventListener('click', async () => {
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    text = prompt('Paste JSON here:');
  }
  if (!text) return;
  try {
    const data = JSON.parse(text);
    // Object format: { segments: [...], eta?: number }
    // Array format (legacy): [[x,y],...] or [[[x,y],...],...]
    let segs, etaOverride = null;
    if (Array.isArray(data)) {
      segs = Array.isArray(data[0][0]) ? data : [data];
    } else {
      segs = data.segments;
      if (typeof data.eta === 'number') etaOverride = data.eta;
    }
    segments  = segs;
    activeSeg = 0;
    if (etaOverride !== null) {
      document.getElementById('sldEta').value = etaOverride;
    }
    draw();
  } catch {
    alert('Invalid JSON — expected [[x,y],...], [[[x,y],...],...], or {"segments":[...],"eta":n}');
  }
});

document.getElementById('btnImportSVG').addEventListener('click', () => {
  document.getElementById('fileSVGImport').click();
});
document.getElementById('fileSVGImport').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const segs = svgFileToSegments(await file.text(), {
    width: canvas.clientWidth, height: canvas.clientHeight,
  });
  e.target.value = '';
  if (!segs) { alert('No supported path found in SVG.'); return; }
  segments = segs; activeSeg = 0; draw();
});

document.getElementById('btnSVG').addEventListener('click', () => {
  const rawEta = parseFloat(document.getElementById('sldEta').value);
  const svg = buildSVG(segments, {
    width:       canvas.clientWidth,
    height:      canvas.clientHeight,
    showGL0:     document.getElementById('chk0').checked,
    showGL1:     document.getElementById('chk1').checked,
    showGL2:     document.getElementById('chk2').checked,
    showM0:      document.getElementById('chkM0').checked,
    showM1:      document.getElementById('chkM1').checked,
    showFrac:    document.getElementById('chkFrac').checked,
    showFracMod: document.getElementById('chkFracMod').checked,
    showPoly:    document.getElementById('chkPoly').checked,
    kFrac:       parseFloat(document.getElementById('sldK').value),
    eta:         rawEta === 0 ? null : rawEta,
    alpha:       parseFloat(document.getElementById('sldAlpha').value),
  });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gl-k-curves.svg';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('chkSVGPreview').addEventListener('change', e => {
  document.getElementById('svgPreview').style.display = e.target.checked ? 'block' : 'none';
  resize();
});

document.getElementById('sldK').addEventListener('input', draw);
document.getElementById('sldEta').addEventListener('input', draw);
document.getElementById('sldAlpha').addEventListener('input', draw);
document.querySelectorAll('input[type=checkbox]').forEach(el =>
  el.addEventListener('change', draw));

resize();
