import { buildSVG }          from './glk-svg.mjs';
import { svgFileToSegments } from './svg-path-import.mjs';
import { state, selKey, isSelected, addToSel, removeFromSel, toggleSel, clearSel }
  from './demo-state.mjs';
import { draw }              from './demo-draw.mjs';

function nearestPoint(x, y, radius = 12) {
  const { segments } = state;
  let best = null, bestD = Infinity;
  for (let s = 0; s < segments.length; s++)
    for (let i = 0; i < segments[s].length; i++) {
      const d = Math.hypot(segments[s][i][0] - x, segments[s][i][1] - y);
      if (d < radius && d < bestD) { best = { s, i }; bestD = d; }
    }
  return best;
}

// ── canvas events ────────────────────────────────────────────────────────────
function bindCanvasEvents(canvas) {
  canvas.addEventListener('mousedown', e => {
    const x = e.offsetX, y = e.offsetY;
    const hit = nearestPoint(x, y);
    state.mouseDownPos = { x, y };
    if (hit) {
      state.drag = hit;
      state.dragDelta = { lastX: x, lastY: y };
      state.activeSeg = hit.s;
      draw();
      return;
    }
    state.rectSelect = { x0: x, y0: y, x1: x, y1: y };
  });

  canvas.addEventListener('mousemove', e => {
    const x = e.offsetX, y = e.offsetY;
    if (state.drag) {
      if (isSelected(state.drag.s, state.drag.i) && state.selection.size > 1) {
        const dx = x - state.dragDelta.lastX, dy = y - state.dragDelta.lastY;
        for (const k of state.selection) {
          const [ss, si] = k.split(':').map(Number);
          const pt = state.segments[ss][si];
          state.segments[ss][si] = [pt[0] + dx, pt[1] + dy];
        }
        state.dragDelta = { lastX: x, lastY: y };
      } else {
        state.segments[state.drag.s][state.drag.i] = [x, y];
      }
      draw(); return;
    }
    if (state.rectSelect) {
      state.rectSelect.x1 = x; state.rectSelect.y1 = y;
      draw(); return;
    }
    // Hover update — only redraw on change
    const hit = nearestPoint(x, y);
    const newKey = hit ? selKey(hit.s, hit.i) : null;
    const oldKey = state.hover ? selKey(state.hover.s, state.hover.i) : null;
    if (newKey !== oldKey) {
      state.hover = hit;
      canvas.style.cursor = hit ? 'pointer' : 'crosshair';
      draw();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (state.hover)     { state.hover = null; canvas.style.cursor = 'crosshair'; draw(); }
    if (state.rectSelect) { state.rectSelect = null; draw(); }
  });

  canvas.addEventListener('mouseup', e => {
    const dist = state.mouseDownPos
      ? Math.hypot(e.offsetX - state.mouseDownPos.x, e.offsetY - state.mouseDownPos.y)
      : Infinity;

    if (state.drag) {
      if (dist < 5) {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          toggleSel(state.drag.s, state.drag.i);
        } else {
          const wasOnly = state.selection.size === 1 && isSelected(state.drag.s, state.drag.i);
          clearSel();
          if (!wasOnly) addToSel(state.drag.s, state.drag.i);
        }
        draw();
      }
      state.drag = null; state.dragDelta = null;
    } else if (state.rectSelect) {
      if (dist < 5) {
        if (state.selection.size > 0) { clearSel(); }
        else { state.segments[state.activeSeg].push([e.offsetX, e.offsetY]); }
      } else {
        const x0 = Math.min(state.rectSelect.x0, state.rectSelect.x1);
        const x1 = Math.max(state.rectSelect.x0, state.rectSelect.x1);
        const y0 = Math.min(state.rectSelect.y0, state.rectSelect.y1);
        const y1 = Math.max(state.rectSelect.y0, state.rectSelect.y1);
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) clearSel();
        for (let s = 0; s < state.segments.length; s++)
          for (let i = 0; i < state.segments[s].length; i++) {
            const [px, py] = state.segments[s][i];
            if (px >= x0 && px <= x1 && py >= y0 && py <= y1) addToSel(s, i);
          }
      }
      state.rectSelect = null; draw();
    }
    state.mouseDownPos = null;
  });

  canvas.addEventListener('dblclick', e => {
    const hit = nearestPoint(e.offsetX, e.offsetY);
    if (!hit) return;
    removeFromSel(hit.s, hit.i);
    state.segments[hit.s].splice(hit.i, 1);
    if (state.segments[hit.s].length === 0 && state.segments.length > 1) {
      state.segments.splice(hit.s, 1);
      state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
    }
    draw();
  });
}

// ── sidebar buttons ──────────────────────────────────────────────────────────
function bindButtonEvents(canvas) {
  document.getElementById('btnSplit').addEventListener('click', () => {
    if (state.selection.size !== 1) return;
    const [key] = state.selection;
    const [s, i] = key.split(':').map(Number);
    const pts = state.segments[s];
    if (i === 0 || i === pts.length - 1) return;
    state.segments.splice(s, 1, pts.slice(0, i + 1), pts.slice(i));
    state.activeSeg = s + 1;
    clearSel(); draw();
  });

  document.getElementById('btnNewSeg').addEventListener('click', () => {
    state.segments.push([]); state.activeSeg = state.segments.length - 1; draw();
  });

  document.getElementById('btnClear').addEventListener('click', () => {
    if (state.segments.length > 1) {
      state.segments.splice(state.activeSeg, 1);
      state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
    } else {
      state.segments[0] = [];
    }
    clearSel(); draw();
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    state.segments = [[[120,350],[200,100],[320,280],[440,80],[560,300],[660,140]]];
    state.activeSeg = 0; clearSel(); draw();
  });

  document.getElementById('btnCopy').addEventListener('click', () => {
    const rounded = state.segments.map(seg => seg.map(([x, y]) => [Math.round(x), Math.round(y)]));
    const raw = parseFloat(document.getElementById('sldEta').value);
    const payload = raw === 0 ? rounded : { segments: rounded, eta: raw };
    navigator.clipboard.writeText(JSON.stringify(payload))
      .catch(() => prompt('Copy this JSON:', JSON.stringify(payload)));
  });

  document.getElementById('btnPaste').addEventListener('click', async () => {
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch { text = prompt('Paste JSON here:'); }
    if (!text) return;
    try {
      const data = JSON.parse(text);
      let segs, etaOverride = null;
      if (Array.isArray(data)) { segs = Array.isArray(data[0][0]) ? data : [data]; }
      else { segs = data.segments; if (typeof data.eta === 'number') etaOverride = data.eta; }
      state.segments = segs; state.activeSeg = 0; clearSel();
      if (etaOverride !== null) document.getElementById('sldEta').value = etaOverride;
      draw();
    } catch {
      alert('Invalid JSON — expected [[x,y],...], [[[x,y],...],...], or {"segments":[...],"eta":n}');
    }
  });

  document.getElementById('btnImportSVG').addEventListener('click', () =>
    document.getElementById('fileSVGImport').click());
  document.getElementById('fileSVGImport').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const segs = svgFileToSegments(await file.text(), {
      width: canvas.clientWidth, height: canvas.clientHeight,
    });
    e.target.value = '';
    if (!segs) { alert('No supported path found in SVG.'); return; }
    state.segments = segs; state.activeSeg = 0; clearSel(); draw();
  });

  document.getElementById('btnSVG').addEventListener('click', () => {
    const rawEta = parseFloat(document.getElementById('sldEta').value);
    const svg = buildSVG(state.segments, {
      width:       canvas.clientWidth,    height:      canvas.clientHeight,
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
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
      download: 'gl-k-curves.svg',
    });
    a.click(); URL.revokeObjectURL(a.href);
  });
}

// ── keyboard ─────────────────────────────────────────────────────────────────
function bindKeyEvents() {
  document.addEventListener('keydown', e => {
    if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      for (let s = 0; s < state.segments.length; s++)
        for (let i = 0; i < state.segments[s].length; i++) addToSel(s, i);
      draw(); return;
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (state.selection.size === 0) return;
    e.preventDefault();
    const toDelete = [...state.selection]
      .map(k => { const [s, i] = k.split(':').map(Number); return { s, i }; })
      .sort((a, b) => b.s - a.s || b.i - a.i);
    for (const { s, i } of toDelete) {
      if (s >= state.segments.length || i >= state.segments[s].length) continue;
      state.segments[s].splice(i, 1);
      if (state.segments[s].length === 0 && state.segments.length > 1) {
        state.segments.splice(s, 1);
        state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
      }
    }
    clearSel(); draw();
  });
}

// ── entry point ──────────────────────────────────────────────────────────────
export function setupInteraction(canvas) {
  bindCanvasEvents(canvas);
  bindButtonEvents(canvas);
  bindKeyEvents();
  document.getElementById('sldK').addEventListener('input', draw);
  document.getElementById('sldEta').addEventListener('input', draw);
  document.getElementById('sldAlpha').addEventListener('input', draw);
  document.querySelectorAll('input[type=checkbox]').forEach(el =>
    el.addEventListener('change', draw));
}
