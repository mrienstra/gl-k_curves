// Shared mutable state for the editor.  All modules mutate properties on this
// object rather than reassigning module-level variables, which keeps ES module
// live-binding semantics simple.

export const state = {
  segments: [
    [
      [120, 350],
      [200, 100],
      [320, 280],
      [440, 80],
      [560, 300],
      [660, 140],
    ],
  ],
  activeSeg: 0,
  drag: null, // { s, i } or null — point being dragged
  selection: new Set(), // Set of "s:i" strings — selected points
  hover: null, // { s, i } or null — point under cursor
  hoverEdge: null, // { s, i, px, py } or null — edge under cursor (insert preview)
  rectSelect: null, // { x0, y0, x1, y1 } or null — marquee in progress
  dragDelta: null, // { lastX, lastY } for multi-point move
  mouseDownPos: null,
};

// ── selection helpers ────────────────────────────────────────────────────────
export const selKey = (s, i) => `${s}:${i}`;
export const isSelected = (s, i) => state.selection.has(selKey(s, i));
export const addToSel = (s, i) => state.selection.add(selKey(s, i));
export const removeFromSel = (s, i) => state.selection.delete(selKey(s, i));
export const toggleSel = (s, i) => {
  const k = selKey(s, i);
  state.selection.has(k) ? state.selection.delete(k) : state.selection.add(k);
};
export const clearSel = () => state.selection.clear();

// ── curve styles ─────────────────────────────────────────────────────────────
// color must be a full 6-digit hex so <input type="color"> can read it back.
export const curveStyles = {
  gl0: { color: "#ff9977", width: 2, dash: [] },
};

// ── undo / redo ──────────────────────────────────────────────────────────────
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 100;

function applySnapshot(snap) {
  state.segments = snap.segments.map((s) => s.map((p) => [p[0], p[1]]));
  state.activeSeg = snap.activeSeg;
  state.selection = new Set(snap.selection);
}

export function captureSnapshot() {
  return {
    segments: state.segments.map((s) => s.map((p) => [p[0], p[1]])),
    activeSeg: state.activeSeg,
    selection: new Set(state.selection),
  };
}

// Push a previously captured snapshot onto the undo stack.
export function commitSnapshot(snap) {
  undoStack.push(snap);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

// Capture current state and push it (convenience for non-drag mutations).
export function pushHistory() {
  commitSnapshot(captureSnapshot());
}

export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(captureSnapshot());
  applySnapshot(undoStack.pop());
  return true;
}

export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(captureSnapshot());
  applySnapshot(redoStack.pop());
  return true;
}
