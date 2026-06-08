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
let activeSeg  = 0;
let drag       = null;      // { s, i } or null — point being dragged
let selection  = new Set(); // Set of "s:i" strings — selected points
let hover      = null;      // { s, i } or null — point under cursor
let rectSelect = null;      // { x0, y0, x1, y1 } or null — marquee in progress
let dragDelta  = null;      // { lastX, lastY } for multi-point move
let mouseDownPos = null;

// ── selection helpers ────────────────────────────────────────────────────────
const selKey     = (s, i) => `${s}:${i}`;
const isSelected = (s, i) => selection.has(selKey(s, i));
const addToSel   = (s, i) => selection.add(selKey(s, i));
const removeFromSel = (s, i) => selection.delete(selKey(s, i));
const toggleSel  = (s, i) => { const k = selKey(s, i); selection.has(k) ? selection.delete(k) : selection.add(k); };
const clearSel   = ()     => selection.clear();

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

function drawPoints(pts, segIdx, isActive) {
  for (let i = 0; i < pts.length; i++) {
    const isSel = isSelected(segIdx, i);
    const isHov = hover && hover.s === segIdx && hover.i === i;
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], isSel ? 7 : (isActive || isHov) ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? '#0ff'
      : isHov ? '#ddd'
      : isActive ? (i === 0 || i === pts.length - 1 ? '#fa6' : '#aaa')
      : '#666';
    ctx.fill();
    if (isActive || isSel || isHov) {
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
    for (let s = 0; s < segments.length; s++)
      drawPoints(segments[s], s, s === activeSeg);

  // Marquee selection rect
  if (rectSelect) {
    const rx = Math.min(rectSelect.x0, rectSelect.x1);
    const ry = Math.min(rectSelect.y0, rectSelect.y1);
    const rw = Math.abs(rectSelect.x1 - rectSelect.x0);
    const rh = Math.abs(rectSelect.y1 - rectSelect.y0);
    ctx.strokeStyle = '#5af';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(85,170,255,0.06)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  document.getElementById('segInfo').textContent = selection.size > 0
    ? `${selection.size} pts — Seg ${activeSeg + 1}/${segments.length}`
    : `Seg ${activeSeg + 1} / ${segments.length}`;
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
  if (hit) {
    drag = hit;
    dragDelta = { lastX: x, lastY: y };
    activeSeg = hit.s;
    draw();
    return;
  }
  rectSelect = { x0: x, y0: y, x1: x, y1: y };
});

canvas.addEventListener('mousemove', e => {
  const x = e.offsetX, y = e.offsetY;
  if (drag) {
    if (isSelected(drag.s, drag.i) && selection.size > 1) {
      // Move all selected points by delta
      const dx = x - dragDelta.lastX, dy = y - dragDelta.lastY;
      for (const k of selection) {
        const [ss, si] = k.split(':').map(Number);
        const pt = segments[ss][si];
        segments[ss][si] = [pt[0] + dx, pt[1] + dy];
      }
      dragDelta = { lastX: x, lastY: y };
    } else {
      segments[drag.s][drag.i] = [x, y];
    }
    draw();
    return;
  }
  if (rectSelect) {
    rectSelect.x1 = x; rectSelect.y1 = y;
    draw();
    return;
  }
  // Hover update
  const hit = nearestPoint(x, y);
  const newKey = hit ? selKey(hit.s, hit.i) : null;
  const oldKey = hover ? selKey(hover.s, hover.i) : null;
  if (newKey !== oldKey) {
    hover = hit;
    canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    draw();
  }
});

canvas.addEventListener('mouseleave', () => {
  if (hover) { hover = null; canvas.style.cursor = 'crosshair'; draw(); }
  if (rectSelect) { rectSelect = null; draw(); }
});

canvas.addEventListener('mouseup', e => {
  const dist = mouseDownPos
    ? Math.hypot(e.offsetX - mouseDownPos.x, e.offsetY - mouseDownPos.y)
    : Infinity;

  if (drag) {
    if (dist < 5) {
      // Click on point: select / toggle
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        toggleSel(drag.s, drag.i);
      } else {
        const wasOnly = selection.size === 1 && isSelected(drag.s, drag.i);
        clearSel();
        if (!wasOnly) addToSel(drag.s, drag.i);
      }
      draw();
    }
    drag = null;
    dragDelta = null;
  } else if (rectSelect) {
    if (dist < 5) {
      // Click on empty canvas: clear selection if any, otherwise add a point
      if (selection.size > 0) {
        clearSel();
      } else {
        segments[activeSeg].push([e.offsetX, e.offsetY]);
      }
    } else {
      // Marquee: select all points inside rect
      const x0 = Math.min(rectSelect.x0, rectSelect.x1);
      const x1 = Math.max(rectSelect.x0, rectSelect.x1);
      const y0 = Math.min(rectSelect.y0, rectSelect.y1);
      const y1 = Math.max(rectSelect.y0, rectSelect.y1);
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) clearSel();
      for (let s = 0; s < segments.length; s++)
        for (let i = 0; i < segments[s].length; i++) {
          const [px, py] = segments[s][i];
          if (px >= x0 && px <= x1 && py >= y0 && py <= y1) addToSel(s, i);
        }
    }
    rectSelect = null;
    draw();
  }
  mouseDownPos = null;
});

canvas.addEventListener('dblclick', e => {
  const hit = nearestPoint(e.offsetX, e.offsetY);
  if (!hit) return;
  removeFromSel(hit.s, hit.i);
  segments[hit.s].splice(hit.i, 1);
  if (segments[hit.s].length === 0 && segments.length > 1) {
    segments.splice(hit.s, 1);
    activeSeg = Math.min(activeSeg, segments.length - 1);
  }
  draw();
});

document.getElementById('btnSplit').addEventListener('click', () => {
  if (selection.size !== 1) return;
  const [key] = selection;
  const [s, i] = key.split(':').map(Number);
  const pts = segments[s];
  if (i === 0 || i === pts.length - 1) return; // endpoint — nothing to split
  segments.splice(s, 1, pts.slice(0, i + 1), pts.slice(i));
  activeSeg = s + 1;
  clearSel();
  draw();
});

document.addEventListener('keydown', e => {
  if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    for (let s = 0; s < segments.length; s++)
      for (let i = 0; i < segments[s].length; i++)
        addToSel(s, i);
    draw();
    return;
  }
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (selection.size === 0) return;
  e.preventDefault();
  // Sort descending so splices don't shift later indices
  const toDelete = [...selection]
    .map(k => { const [s, i] = k.split(':').map(Number); return { s, i }; })
    .sort((a, b) => b.s - a.s || b.i - a.i);
  for (const { s, i } of toDelete) {
    if (s >= segments.length || i >= segments[s].length) continue;
    segments[s].splice(i, 1);
    if (segments[s].length === 0 && segments.length > 1) {
      segments.splice(s, 1);
      activeSeg = Math.min(activeSeg, segments.length - 1);
    }
  }
  clearSel();
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
  clearSel();
  draw();
});

document.getElementById('btnReset').addEventListener('click', () => {
  segments = [
    [[120, 350], [200, 100], [320, 280], [440, 80], [560, 300], [660, 140]],
  ];
  activeSeg = 0;
  clearSel();
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
    clearSel();
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
  segments = segs; activeSeg = 0; clearSel(); draw();
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
