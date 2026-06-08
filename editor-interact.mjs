import { buildSVG } from "./glk-svg.mjs";
import { svgFileToSegments } from "./svg-path-import.mjs";
import {
  state,
  selKey,
  isSelected,
  addToSel,
  removeFromSel,
  toggleSel,
  clearSel,
  pushHistory,
  captureSnapshot,
  commitSnapshot,
  undo,
  redo,
  curveStyles,
} from "./editor-state.mjs";
import { draw } from "./editor-draw.mjs";

// Returns { s, i, px, py } for the closest polyline edge within threshold,
// or null if none / ambiguous (two edges within ambiguityMargin of each other).
function nearestEdge(x, y, threshold = 15, ambiguityMargin = 5) {
  const { segments } = state;
  let best = null, bestD = Infinity, secondBestD = Infinity;
  for (let s = 0; s < segments.length; s++) {
    const pts = segments[s];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const px = ax + t * dx, py = ay + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < threshold) {
        if (d < bestD) { secondBestD = bestD; best = { s, i, px, py }; bestD = d; }
        else if (d < secondBestD) { secondBestD = d; }
      }
    }
  }
  if (best && secondBestD - bestD < ambiguityMargin) return null;
  return best;
}

function nearestPoint(x, y, radius = 12) {
  const { segments } = state;
  let best = null,
    bestD = Infinity;
  for (let s = 0; s < segments.length; s++)
    for (let i = 0; i < segments[s].length; i++) {
      const d = Math.hypot(segments[s][i][0] - x, segments[s][i][1] - y);
      if (d < radius && d < bestD) {
        best = { s, i };
        bestD = d;
      }
    }
  return best;
}

// ── canvas events ────────────────────────────────────────────────────────────
function bindCanvasEvents(canvas) {
  // Snapshot taken at drag-start; committed to undo stack only if the point moved.
  let preDragSnapshot = null;

  canvas.addEventListener("mousedown", (e) => {
    const x = e.offsetX,
      y = e.offsetY;
    const hit = nearestPoint(x, y);
    state.mouseDownPos = { x, y };
    if (hit) {
      preDragSnapshot = captureSnapshot();
      state.drag = hit;
      state.dragDelta = { lastX: x, lastY: y };
      state.activeSeg = hit.s;
      draw();
      return;
    }
    state.rectSelect = { x0: x, y0: y, x1: x, y1: y };
  });

  canvas.addEventListener("mousemove", (e) => {
    const x = e.offsetX,
      y = e.offsetY;
    if (state.drag) {
      if (isSelected(state.drag.s, state.drag.i) && state.selection.size > 1) {
        const dx = x - state.dragDelta.lastX,
          dy = y - state.dragDelta.lastY;
        for (const k of state.selection) {
          const [ss, si] = k.split(":").map(Number);
          const pt = state.segments[ss][si];
          state.segments[ss][si] = [pt[0] + dx, pt[1] + dy];
        }
        state.dragDelta = { lastX: x, lastY: y };
      } else {
        state.segments[state.drag.s][state.drag.i] = [x, y];
      }
      draw();
      return;
    }
    if (state.rectSelect) {
      state.rectSelect.x1 = x;
      state.rectSelect.y1 = y;
      draw();
      return;
    }
    // Hover update — only redraw on change
    const hit = nearestPoint(x, y);
    const edge = hit ? null : nearestEdge(x, y, 15, 0); // no ambiguity check for preview
    const newKey = hit ? selKey(hit.s, hit.i) : null;
    const oldKey = state.hover ? selKey(state.hover.s, state.hover.i) : null;
    const edgeMoved = edge && state.hoverEdge && (
      Math.abs(edge.px - state.hoverEdge.px) > 0.5 ||
      Math.abs(edge.py - state.hoverEdge.py) > 0.5
    );
    const edgeKeyChanged = (edge?.s !== state.hoverEdge?.s) || (edge?.i !== state.hoverEdge?.i);
    if (newKey !== oldKey || edgeKeyChanged || edgeMoved) {
      state.hover = hit;
      state.hoverEdge = edge;
      canvas.style.cursor = hit ? "pointer" : edge ? "none" : "crosshair";
      draw();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    let dirty = false;
    if (state.hover) { state.hover = null; canvas.style.cursor = "crosshair"; dirty = true; }
    if (state.hoverEdge) { state.hoverEdge = null; dirty = true; }
    if (state.rectSelect) { state.rectSelect = null; dirty = true; }
    if (dirty) draw();
  });

  canvas.addEventListener("mouseup", (e) => {
    const dist = state.mouseDownPos
      ? Math.hypot(
          e.offsetX - state.mouseDownPos.x,
          e.offsetY - state.mouseDownPos.y,
        )
      : Infinity;

    if (state.drag) {
      if (dist < 5) {
        // Click, not a drag — discard the pre-drag snapshot
        preDragSnapshot = null;
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          toggleSel(state.drag.s, state.drag.i);
        } else {
          const wasOnly =
            state.selection.size === 1 &&
            isSelected(state.drag.s, state.drag.i);
          clearSel();
          if (!wasOnly) addToSel(state.drag.s, state.drag.i);
        }
        draw();
      } else {
        // Actual move — commit the pre-drag snapshot
        commitSnapshot(preDragSnapshot);
        preDragSnapshot = null;
      }
      state.drag = null;
      state.dragDelta = null;
    } else if (state.rectSelect) {
      if (dist < 5) {
        if (state.selection.size > 0) {
          clearSel();
        } else {
          const edge = nearestEdge(e.offsetX, e.offsetY);
          pushHistory();
          if (edge) {
            state.segments[edge.s].splice(edge.i + 1, 0, [e.offsetX, e.offsetY]);
            state.activeSeg = edge.s;
          } else {
            state.segments[state.activeSeg].push([e.offsetX, e.offsetY]);
          }
        }
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
      state.rectSelect = null;
      draw();
    }
    state.mouseDownPos = null;
  });

  canvas.addEventListener("dblclick", (e) => {
    const hit = nearestPoint(e.offsetX, e.offsetY);
    if (!hit) return;
    pushHistory();
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
  document.getElementById("btnSplit").addEventListener("click", () => {
    const selArr = [...state.selection].map((k) => {
      const [s, i] = k.split(":").map(Number);
      return { s, i };
    });

    if (selArr.length === 1) {
      // Split
      const { s, i } = selArr[0];
      const pts = state.segments[s];
      if (i === 0 || i === pts.length - 1) return;
      pushHistory();
      state.segments.splice(s, 1, pts.slice(0, i + 1), pts.slice(i));
      state.activeSeg = s + 1;
      clearSel();
      draw();
    } else if (selArr.length === 2) {
      // Join — orient each segment so the selected endpoint is the tail of a / head of b
      const [{ s: s1, i: i1 }, { s: s2, i: i2 }] = selArr;
      if (s1 === s2) return;
      const pts1 = state.segments[s1], pts2 = state.segments[s2];
      if (!(i1 === 0 || i1 === pts1.length - 1)) return;
      if (!(i2 === 0 || i2 === pts2.length - 1)) return;

      const a = i1 === 0 ? pts1.slice().reverse() : pts1.slice(); // selected pt → tail
      const b = i2 === pts2.length - 1 ? pts2.slice().reverse() : pts2.slice(); // selected pt → head

      // Merge: average the two touching endpoints into one
      const jx = (a[a.length - 1][0] + b[0][0]) / 2;
      const jy = (a[a.length - 1][1] + b[0][1]) / 2;
      a[a.length - 1] = [jx, jy];
      const merged = [...a, ...b.slice(1)];

      // Splice out both segments (higher index first to preserve lower index)
      pushHistory();
      const [hi, lo] = s1 > s2 ? [s1, s2] : [s2, s1];
      state.segments.splice(hi, 1);
      state.segments.splice(lo, 1, merged);
      state.activeSeg = lo;
      clearSel();
      draw();
    }
  });

  document.getElementById("btnNewSeg").addEventListener("click", () => {
    pushHistory();
    state.segments.push([]);
    state.activeSeg = state.segments.length - 1;
    draw();
  });

  document.getElementById("btnClear").addEventListener("click", () => {
    pushHistory();
    if (state.segments.length > 1) {
      state.segments.splice(state.activeSeg, 1);
      state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
    } else {
      state.segments[0] = [];
    }
    clearSel();
    draw();
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    pushHistory();
    state.segments = [
      [
        [120, 350],
        [200, 100],
        [320, 280],
        [440, 80],
        [560, 300],
        [660, 140],
      ],
    ];
    state.activeSeg = 0;
    clearSel();
    draw();
  });

  document.getElementById("btnCopy").addEventListener("click", () => {
    const rounded = state.segments.map((seg) =>
      seg.map(([x, y]) => [Math.round(x), Math.round(y)]),
    );
    const raw = parseFloat(document.getElementById("sldEta").value);
    const s = curveStyles.gl0;
    const hasCustomStyle = s.color !== "#ff9977" || s.width !== 2 || s.dash.length > 0;
    const hasEta = raw !== 0;
    if (!hasEta && !hasCustomStyle) {
      var payload = rounded;
    } else {
      var payload = { segments: rounded };
      if (hasEta) payload.eta = raw;
      if (hasCustomStyle) payload.styles = { gl0: { color: s.color, width: s.width, dash: s.dash } };
    }
    navigator.clipboard
      .writeText(JSON.stringify(payload))
      .catch(() => prompt("Copy this JSON:", JSON.stringify(payload)));
  });

  document.getElementById("btnPaste").addEventListener("click", async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = prompt("Paste JSON here:");
    }
    if (!text) return;
    try {
      const data = JSON.parse(text);
      let segs,
        etaOverride = null;
      if (Array.isArray(data)) {
        segs = Array.isArray(data[0][0]) ? data : [data];
      } else {
        segs = data.segments;
        if (typeof data.eta === "number") etaOverride = data.eta;
      }
      pushHistory();
      state.segments = segs;
      state.activeSeg = 0;
      clearSel();
      if (etaOverride !== null)
        document.getElementById("sldEta").value = etaOverride;
      if (typeof data.styles?.gl0 === "object")
        Object.assign(curveStyles.gl0, data.styles.gl0);
      draw();
    } catch {
      alert(
        'Invalid JSON — expected [[x,y],...], [[[x,y],...],...], or {"segments":[...],"eta":n}',
      );
    }
  });

  document
    .getElementById("btnImportSVG")
    .addEventListener("click", () =>
      document.getElementById("fileSVGImport").click(),
    );
  document
    .getElementById("fileSVGImport")
    .addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const segs = svgFileToSegments(await file.text(), {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
      e.target.value = "";
      if (!segs) {
        alert("No supported path found in SVG.");
        return;
      }
      pushHistory();
      state.segments = segs;
      state.activeSeg = 0;
      clearSel();
      draw();
    });

  document.getElementById("btnSVG").addEventListener("click", () => {
    const rawEta = parseFloat(document.getElementById("sldEta").value);
    const svg = buildSVG(state.segments, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      showGL0: document.getElementById("chk0").checked,
      showGL1: document.getElementById("chk1").checked,
      showGL2: document.getElementById("chk2").checked,
      showM0: document.getElementById("chkM0").checked,
      showM1: document.getElementById("chkM1").checked,
      showFrac: document.getElementById("chkFrac").checked,
      showFracMod: document.getElementById("chkFracMod").checked,
      showPoly: document.getElementById("chkPoly").checked,
      kFrac: parseFloat(document.getElementById("sldK").value),
      eta: rawEta === 0 ? null : rawEta,
      alpha: parseFloat(document.getElementById("sldAlpha").value),
      styles: { gl0: curveStyles.gl0 },
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
      download: "gl-k-curves.svg",
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ── keyboard ─────────────────────────────────────────────────────────────────
function bindKeyEvents() {
  document.addEventListener("keydown", (e) => {
    if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey) { if (redo()) draw(); }
      else            { if (undo()) draw(); }
      return;
    }
    if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      for (let s = 0; s < state.segments.length; s++)
        for (let i = 0; i < state.segments[s].length; i++) addToSel(s, i);
      draw();
      return;
    }
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (state.selection.size === 0) return;
    e.preventDefault();
    pushHistory();
    const toDelete = [...state.selection]
      .map((k) => {
        const [s, i] = k.split(":").map(Number);
        return { s, i };
      })
      .sort((a, b) => b.s - a.s || b.i - a.i);
    for (const { s, i } of toDelete) {
      if (s >= state.segments.length || i >= state.segments[s].length) continue;
      state.segments[s].splice(i, 1);
      if (state.segments[s].length === 0 && state.segments.length > 1) {
        state.segments.splice(s, 1);
        state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
      }
    }
    clearSel();
    draw();
  });
}

// ── style modal ──────────────────────────────────────────────────────────────
function bindStyleModal() {
  const modal = document.getElementById("styleModal");
  const titleEl = document.getElementById("styleModalTitle");
  const colorIn = document.getElementById("styleColor");
  const widthIn = document.getElementById("styleWidth");
  const dashIn  = document.getElementById("styleDash");

  // Which style object is currently being edited
  let target = null;

  function open(style, label) {
    target = style;
    titleEl.textContent = label + " style";
    colorIn.value = style.color;
    widthIn.value = style.width;
    dashIn.value  = style.dash.join(", ");
    modal.style.display = "flex";
  }

  document.getElementById("btnStyle0").addEventListener("click", () => open(curveStyles.gl0, "GL-0"));

  document.getElementById("btnStyleClose").addEventListener("click", () => {
    modal.style.display = "none";
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  colorIn.addEventListener("input", (e) => {
    if (!target) return;
    target.color = e.target.value;
    draw();
  });

  widthIn.addEventListener("input", (e) => {
    if (!target) return;
    const v = parseFloat(e.target.value);
    if (v > 0) { target.width = v; draw(); }
  });

  dashIn.addEventListener("input", (e) => {
    if (!target) return;
    const raw = e.target.value.trim();
    if (raw === "") {
      target.dash = [];
    } else {
      const parts = raw.split(",").map((s) => parseFloat(s.trim()));
      if (parts.some((n) => isNaN(n) || n < 0)) return; // invalid — wait for more input
      target.dash = parts;
    }
    draw();
  });
}

// ── entry point ──────────────────────────────────────────────────────────────
export function setupInteraction(canvas) {
  bindCanvasEvents(canvas);
  bindButtonEvents(canvas);
  bindKeyEvents();
  bindStyleModal();
  document.getElementById("sldK").addEventListener("input", draw);
  document.getElementById("sldEta").addEventListener("input", draw);
  document.getElementById("sldAlpha").addEventListener("input", draw);
  document
    .querySelectorAll("input[type=checkbox]")
    .forEach((el) => el.addEventListener("change", draw));
}
