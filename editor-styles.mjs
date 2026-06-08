/**
 * Style customization modal + JSON serialization helpers for curve styles
 * and curve visibility.
 */

import { curveStyles } from "./editor-state.mjs";
import { draw } from "./editor-draw.mjs";

// ── defaults ──────────────────────────────────────────────────────────────────

const STYLE_DEFAULTS = {
  gl0:    { color: "#ff9977", width: 2,   dash: [] },
  gl1:    { color: "#77bbff", width: 2,   dash: [] },
  gl2:    { color: "#88ff88", width: 2,   dash: [] },
  modGl1: { color: "#ffcc66", width: 2.5, dash: [] },
  frac:   { color: "#ffffff", width: 1.5, dash: [8, 3] },
  points: { opacity: 1 },
};

// Map from JSON key → checkbox element id
const VIS_IDS = {
  gl0:    "chk0",
  gl1:    "chk1",
  gl2:    "chk2",
  modGl1: "chkM1",
  frac:   "chkFrac",
  fracMod:"chkFracMod",
  poly:   "chkPoly",
};

// Default checked state matching the HTML
const VIS_DEFAULTS = {
  gl0: true, gl1: true, gl2: true, modGl1: true,
  frac: false, fracMod: false, poly: true,
};

// ── serialization helpers ─────────────────────────────────────────────────────

function styleChanged(key) {
  const s = curveStyles[key];
  const d = STYLE_DEFAULTS[key];
  return Object.keys(d).some((prop) => {
    if (Array.isArray(d[prop])) return s[prop].join(",") !== d[prop].join(",");
    return s[prop] !== d[prop];
  });
}

/** Returns a styles object containing only non-default entries, or null. */
export function collectStyles() {
  const out = {};
  for (const key of Object.keys(STYLE_DEFAULTS)) {
    if (styleChanged(key)) out[key] = { ...curveStyles[key] };
  }
  return Object.keys(out).length ? out : null;
}

/** Merges a parsed styles object into curveStyles. */
export function applyStyles(stylesData) {
  if (!stylesData || typeof stylesData !== "object") return;
  for (const [key, val] of Object.entries(stylesData)) {
    if (curveStyles[key] && typeof val === "object")
      Object.assign(curveStyles[key], val);
  }
}

/** Returns a visibility object if any differ from defaults, else null. */
export function collectVisibility() {
  const out = {};
  let hasCustom = false;
  for (const [key, id] of Object.entries(VIS_IDS)) {
    out[key] = document.getElementById(id).checked;
    if (out[key] !== VIS_DEFAULTS[key]) hasCustom = true;
  }
  return hasCustom ? out : null;
}

/** Applies a parsed visibility object to checkboxes. */
export function applyVisibility(visData) {
  if (!visData || typeof visData !== "object") return;
  for (const [key, id] of Object.entries(VIS_IDS)) {
    if (typeof visData[key] === "boolean")
      document.getElementById(id).checked = visData[key];
  }
}

// ── style modal ───────────────────────────────────────────────────────────────

export function bindStyleModal() {
  const modal      = document.getElementById("styleModal");
  const titleEl    = document.getElementById("styleModalTitle");
  const colorIn    = document.getElementById("styleColor");
  const widthIn    = document.getElementById("styleWidth");
  const dashIn     = document.getElementById("styleDash");
  const opacityIn  = document.getElementById("styleOpacity");
  const colorRow   = document.getElementById("modalColorRow");
  const widthRow   = document.getElementById("modalWidthRow");
  const dashRow    = document.getElementById("modalDashRow");
  const opacityRow = document.getElementById("modalOpacityRow");

  let target = null;

  function open(style, label, isPoints = false) {
    target = style;
    titleEl.textContent = label + " style";
    const d = isPoints ? "none" : "";
    colorRow.style.display   = d;
    widthRow.style.display   = d;
    dashRow.style.display    = d;
    opacityRow.style.display = isPoints ? "" : "none";
    if (isPoints) {
      opacityIn.value = style.opacity;
    } else {
      colorIn.value = style.color;
      widthIn.value = style.width;
      dashIn.value  = style.dash.join(", ");
    }
    modal.style.display = "flex";
  }

  // One button per style
  document.getElementById("btnStyle0").addEventListener("click",      () => open(curveStyles.gl0,    "GL-0"));
  document.getElementById("btnStyle1").addEventListener("click",      () => open(curveStyles.gl1,    "GL-1"));
  document.getElementById("btnStyle2").addEventListener("click",      () => open(curveStyles.gl2,    "GL-2"));
  document.getElementById("btnStyleM1").addEventListener("click",     () => open(curveStyles.modGl1, "mod GL-1"));
  document.getElementById("btnStyleFrac").addEventListener("click",   () => open(curveStyles.frac,   "GL-k frac"));
  document.getElementById("btnStylePoints").addEventListener("click", () => open(curveStyles.points, "points", true));

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
      if (parts.some((n) => isNaN(n) || n < 0)) return;
      target.dash = parts;
    }
    draw();
  });
  opacityIn.addEventListener("input", (e) => {
    if (!target) return;
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v >= 0 && v <= 1) { target.opacity = v; draw(); }
  });
}
