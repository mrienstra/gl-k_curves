import { buildSVG } from "./glk-svg";
import { computeAutoSeamT } from "./glk-closed";
import { svgFileToSegments } from "./svg-path-import";
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
  getClosedOpts,
} from "./editor-state";
import { draw } from "./editor-draw";
import {
  bindStyleModal,
  collectStyles,
  applyStyles,
  collectVisibility,
  applyVisibility,
} from "./editor-styles.mjs";

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
      const s = hit.s;
      state.closed.delete(s);
      const newClosed = new Set();
      for (const idx of state.closed) newClosed.add(idx > s ? idx - 1 : idx);
      state.closed = newClosed;
      const newClosedOpts = new Map();
      for (const [idx, o] of state.closedOpts) if (idx !== s) newClosedOpts.set(idx > s ? idx - 1 : idx, o);
      state.closedOpts = newClosedOpts;
      state.segments.splice(s, 1);
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
      // Splitting always opens the segment; shift closed indices above s up by 1
      state.closed.delete(s);
      const newClosed = new Set();
      for (const idx of state.closed) newClosed.add(idx > s ? idx + 1 : idx);
      state.closed = newClosed;
      const newClosedOpts = new Map();
      for (const [idx, o] of state.closedOpts) if (idx !== s) newClosedOpts.set(idx > s ? idx + 1 : idx, o);
      state.closedOpts = newClosedOpts;
      state.segments.splice(s, 1, pts.slice(0, i + 1), pts.slice(i));
      state.activeSeg = s + 1;
      clearSel();
      draw();
    } else if (selArr.length === 2) {
      const [{ s: s1, i: i1 }, { s: s2, i: i2 }] = selArr;
      const pts1 = state.segments[s1], pts2 = state.segments[s2];
      if (!(i1 === 0 || i1 === pts1.length - 1)) return;
      if (!(i2 === 0 || i2 === pts2.length - 1)) return;

      if (s1 === s2) {
        // Close / open — must be the two distinct endpoints of the same segment
        if (i1 === i2) return;
        if (!((i1 === 0 && i2 === pts1.length - 1) || (i2 === 0 && i1 === pts1.length - 1))) return;
        pushHistory();
        if (state.closed.has(s1)) {
          state.closed.delete(s1);
        } else {
          // Average the two endpoint positions (same as joining two segments)
          const pts = state.segments[s1];
          const jx = (pts[0][0] + pts[pts.length - 1][0]) / 2;
          const jy = (pts[0][1] + pts[pts.length - 1][1]) / 2;
          pts[0] = [jx, jy];
          pts[pts.length - 1] = [jx, jy];
          state.closed.add(s1);
        }
        clearSel();
        draw();
        return;
      }

      // Join — orient each segment so the selected endpoint is the tail of a / head of b
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
      // Both source segments lose their closed state; shift indices above hi down by 1
      state.closed.delete(s1);
      state.closed.delete(s2);
      const newClosed = new Set();
      for (const idx of state.closed) newClosed.add(idx > hi ? idx - 1 : idx);
      state.closed = newClosed;
      const newClosedOpts = new Map();
      for (const [idx, o] of state.closedOpts) if (idx !== s1 && idx !== s2) newClosedOpts.set(idx > hi ? idx - 1 : idx, o);
      state.closedOpts = newClosedOpts;
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
      const s = state.activeSeg;
      state.closed.delete(s);
      const newClosed = new Set();
      for (const idx of state.closed) newClosed.add(idx > s ? idx - 1 : idx);
      state.closed = newClosed;
      const newClosedOpts = new Map();
      for (const [idx, o] of state.closedOpts) if (idx !== s) newClosedOpts.set(idx > s ? idx - 1 : idx, o);
      state.closedOpts = newClosedOpts;
      state.segments.splice(s, 1);
      state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
    } else {
      state.segments[0] = [];
      state.closed.delete(0);
      state.closedOpts.delete(0);
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
    state.closed = new Set();
    state.closedOpts = new Map();
    clearSel();
    draw();
  });

  document.getElementById("btnCopy").addEventListener("click", () => {
    const rounded = state.segments.map((seg) =>
      seg.map(([x, y]) => [Math.round(x), Math.round(y)]),
    );
    const raw = parseFloat(document.getElementById("sldEta").value);
    const styles = collectStyles();
    const visibility = collectVisibility();
    const hasEta = raw !== 0;
    let payload;
    if (!hasEta && !styles && !visibility) {
      payload = rounded;
    } else {
      payload = { segments: rounded };
      if (hasEta) payload.eta = raw;
      if (styles) payload.styles = styles;
      if (visibility) payload.visibility = visibility;
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
      applyStyles(data.styles);
      applyVisibility(data.visibility);
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
      showM1: document.getElementById("chkM1").checked,
      showFrac: document.getElementById("chkFrac").checked,
      showFracMod: document.getElementById("chkFracMod").checked,
      showPoly: document.getElementById("chkPoly").checked,
      kFrac: parseFloat(document.getElementById("sldK").value),
      eta: rawEta === 0 ? null : rawEta,
      alpha: parseFloat(document.getElementById("sldAlpha").value),
      styles: collectStyles() ?? {},
      closedSet: state.closed,
      closedOptsMap: state.closedOpts,
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
        state.closed.delete(s);
        const newClosed = new Set();
        for (const idx of state.closed) newClosed.add(idx > s ? idx - 1 : idx);
        state.closed = newClosed;
        const newClosedOpts = new Map();
        for (const [idx, o] of state.closedOpts) if (idx !== s) newClosedOpts.set(idx > s ? idx - 1 : idx, o);
        state.closedOpts = newClosedOpts;
        state.segments.splice(s, 1);
        state.activeSeg = Math.min(state.activeSeg, state.segments.length - 1);
      }
    }
    clearSel();
    draw();
  });
}

// ── closed-path options modal ─────────────────────────────────────────────────
function bindClosedOptsModal() {
  const modal       = document.getElementById("closedOptsModal");
  const inCopies    = document.getElementById("closedOptsCopies");
  const inFull      = document.getElementById("closedOptsShowFull");
  const inSeamTAuto = document.getElementById("closedOptsSeamTAuto");
  const inSeamT     = document.getElementById("closedOptsSeamT");
  const seamTVal    = document.getElementById("closedOptsSeamTVal");
  const autoVals    = document.getElementById("closedOptsSeamTAutoVals");
  let segIdx = null;
  let autoSeamTs = null; // { k0, k1, k2 } — computed on modal open

  function updateSeamTDisplay() {
    if (inSeamTAuto.checked) {
      seamTVal.textContent = "auto";
      inSeamT.disabled = true;
      if (autoSeamTs) {
        autoVals.textContent =
          `0: ${autoSeamTs.k0.toFixed(3)}  1: ${autoSeamTs.k1.toFixed(3)}  2: ${autoSeamTs.k2.toFixed(3)}`;
        autoVals.style.display = "";
      } else {
        autoVals.style.display = "none";
      }
    } else {
      seamTVal.textContent = parseFloat(inSeamT.value).toFixed(3);
      inSeamT.disabled = false;
      autoVals.style.display = "none";
    }
  }

  document.getElementById("btnClosedOpts").addEventListener("click", () => {
    segIdx = state.activeSeg;
    const opts = getClosedOpts(segIdx);
    inCopies.value      = opts.copies;
    inFull.checked      = opts.showFull;
    const hasSeamT      = opts.seamT != null;
    inSeamTAuto.checked = !hasSeamT;

    // Compute auto seam T values for k=0,1,2
    const pts = state.segments[segIdx];
    if (pts && pts.length >= 3) {
      const copies = parseInt(inCopies.value, 10) || 3;
      autoSeamTs = {
        k0: computeAutoSeamT(pts, copies, 0),
        k1: computeAutoSeamT(pts, copies, 1),
        k2: computeAutoSeamT(pts, copies, 2),
      };
    } else {
      autoSeamTs = null;
    }

    // Pre-fill slider: use stored value if manual, else the k1 auto value
    if (hasSeamT) {
      inSeamT.value = opts.seamT;
    } else if (autoSeamTs) {
      inSeamT.value = autoSeamTs.k1;
    }

    updateSeamTDisplay();
    modal.style.display = "flex";
  });

  document.getElementById("btnClosedOptsClose").addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  function applyOpts() {
    if (segIdx === null) return;
    let copies = parseInt(inCopies.value, 10);
    if (!isFinite(copies) || copies < 3) copies = 3;
    if (copies % 2 === 0) copies++;
    inCopies.value = copies; // snap display back to valid odd value
    const seamT = inSeamTAuto.checked ? null : parseFloat(inSeamT.value);
    state.closedOpts.set(segIdx, { copies, showFull: inFull.checked, seamT });
    draw();
  }

  inCopies.addEventListener("input", applyOpts);
  inFull.addEventListener("change", applyOpts);
  inSeamTAuto.addEventListener("change", () => {
    // When switching auto → manual, pre-fill slider with k1 auto value
    if (!inSeamTAuto.checked && autoSeamTs) inSeamT.value = autoSeamTs.k1;
    updateSeamTDisplay();
    applyOpts();
  });
  inSeamT.addEventListener("input", () => { updateSeamTDisplay(); applyOpts(); });
}

// ── entry point ──────────────────────────────────────────────────────────────
export function setupInteraction(canvas) {
  bindCanvasEvents(canvas);
  bindButtonEvents(canvas);
  bindKeyEvents();
  bindStyleModal();
  bindClosedOptsModal();
  document.getElementById("sldK").addEventListener("input", draw);
  document.getElementById("sldEta").addEventListener("input", draw);
  document.getElementById("sldAlpha").addEventListener("input", draw);
  document
    .querySelectorAll("input[type=checkbox]")
    .forEach((el) => el.addEventListener("change", draw));
}
