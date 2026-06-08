/**
 * Style customization modal + JSON serialization helpers for curve styles
 * and curve visibility.
 */

import { curveStyles } from "./editor-state";
import { draw } from "./editor-draw";

// ── types ─────────────────────────────────────────────────────────────────────

type CurveStyle = { color: string; width: number; dash: number[] };
type PointsStyle = { opacity: number };
type StyleTarget = CurveStyle | PointsStyle;

// ── defaults ──────────────────────────────────────────────────────────────────

const STYLE_DEFAULTS: typeof curveStyles = {
  gl0:    { color: "#ff9977", width: 2,   dash: [] as number[] },
  gl1:    { color: "#77bbff", width: 2,   dash: [] as number[] },
  gl2:    { color: "#88ff88", width: 2,   dash: [] as number[] },
  modGl1: { color: "#ffcc66", width: 2.5, dash: [] as number[] },
  frac:   { color: "#ffffff", width: 1.5, dash: [8, 3] },
  points: { opacity: 1 },
};

// Map from JSON key → checkbox element id
const VIS_IDS: Record<string, string> = {
  gl0:     "chk0",
  gl1:     "chk1",
  gl2:     "chk2",
  modGl1:  "chkM1",
  frac:    "chkFrac",
  fracMod: "chkFracMod",
  poly:    "chkPoly",
};

// Default checked state matching the HTML
const VIS_DEFAULTS: Record<string, boolean> = {
  gl0: true, gl1: true, gl2: true, modGl1: true,
  frac: false, fracMod: false, poly: true,
};

// ── serialization helpers ─────────────────────────────────────────────────────

function styleChanged(key: keyof typeof curveStyles): boolean {
  const s = curveStyles[key] as Record<string, unknown>;
  const d = STYLE_DEFAULTS[key] as Record<string, unknown>;
  return Object.keys(d).some((prop) => {
    if (Array.isArray(d[prop])) return (s[prop] as number[]).join(",") !== (d[prop] as number[]).join(",");
    return s[prop] !== d[prop];
  });
}

/** Returns a styles object containing only non-default entries, or null. */
export function collectStyles(): Record<string, Record<string, unknown>> | null {
  const out: Record<string, Record<string, unknown>> = {};
  for (const key of Object.keys(STYLE_DEFAULTS) as (keyof typeof curveStyles)[]) {
    if (styleChanged(key)) out[key] = { ...(curveStyles[key] as Record<string, unknown>) };
  }
  return Object.keys(out).length ? out : null;
}

/** Merges a parsed styles object into curveStyles. */
export function applyStyles(stylesData: unknown): void {
  if (!stylesData || typeof stylesData !== "object") return;
  for (const [key, val] of Object.entries(stylesData as Record<string, unknown>)) {
    if (key in curveStyles && val && typeof val === "object")
      Object.assign(curveStyles[key as keyof typeof curveStyles], val);
  }
}

/** Returns a visibility object if any differ from defaults, else null. */
export function collectVisibility(): Record<string, boolean> | null {
  const out: Record<string, boolean> = {};
  let hasCustom = false;
  for (const [key, id] of Object.entries(VIS_IDS)) {
    out[key] = (document.getElementById(id) as HTMLInputElement).checked;
    if (out[key] !== VIS_DEFAULTS[key]) hasCustom = true;
  }
  return hasCustom ? out : null;
}

/** Applies a parsed visibility object to checkboxes. */
export function applyVisibility(visData: unknown): void {
  if (!visData || typeof visData !== "object") return;
  for (const [key, id] of Object.entries(VIS_IDS)) {
    const val = (visData as Record<string, unknown>)[key];
    if (typeof val === "boolean")
      (document.getElementById(id) as HTMLInputElement).checked = val;
  }
}

// ── style modal ───────────────────────────────────────────────────────────────

export function bindStyleModal(): void {
  const modal      = document.getElementById("styleModal") as HTMLElement;
  const titleEl    = document.getElementById("styleModalTitle") as HTMLElement;
  const colorIn    = document.getElementById("styleColor") as HTMLInputElement;
  const widthIn    = document.getElementById("styleWidth") as HTMLInputElement;
  const dashIn     = document.getElementById("styleDash") as HTMLInputElement;
  const opacityIn  = document.getElementById("styleOpacity") as HTMLInputElement;
  const colorRow   = document.getElementById("modalColorRow") as HTMLElement;
  const widthRow   = document.getElementById("modalWidthRow") as HTMLElement;
  const dashRow    = document.getElementById("modalDashRow") as HTMLElement;
  const opacityRow = document.getElementById("modalOpacityRow") as HTMLElement;

  let target: StyleTarget | null = null;

  function open(style: StyleTarget, label: string, isPoints = false): void {
    target = style;
    titleEl.textContent = label + " style";
    const d = isPoints ? "none" : "";
    colorRow.style.display   = d;
    widthRow.style.display   = d;
    dashRow.style.display    = d;
    opacityRow.style.display = isPoints ? "" : "none";
    if (isPoints) {
      opacityIn.value = String((style as PointsStyle).opacity);
    } else {
      const cs = style as CurveStyle;
      colorIn.value = cs.color;
      widthIn.value = String(cs.width);
      dashIn.value  = cs.dash.join(", ");
    }
    modal.style.display = "flex";
  }

  // One button per style
  document.getElementById("btnStyle0")!.addEventListener("click",      () => open(curveStyles.gl0,    "GL-0"));
  document.getElementById("btnStyle1")!.addEventListener("click",      () => open(curveStyles.gl1,    "GL-1"));
  document.getElementById("btnStyle2")!.addEventListener("click",      () => open(curveStyles.gl2,    "GL-2"));
  document.getElementById("btnStyleM1")!.addEventListener("click",     () => open(curveStyles.modGl1, "mod GL-1"));
  document.getElementById("btnStyleFrac")!.addEventListener("click",   () => open(curveStyles.frac,   "GL-k frac"));
  document.getElementById("btnStylePoints")!.addEventListener("click", () => open(curveStyles.points, "points", true));

  document.getElementById("btnStyleClose")!.addEventListener("click", () => {
    modal.style.display = "none";
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  colorIn.addEventListener("input", (e) => {
    if (!target) return;
    (target as CurveStyle).color = (e.target as HTMLInputElement).value;
    draw();
  });
  widthIn.addEventListener("input", (e) => {
    if (!target) return;
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (v > 0) { (target as CurveStyle).width = v; draw(); }
  });
  dashIn.addEventListener("input", (e) => {
    if (!target) return;
    const raw = (e.target as HTMLInputElement).value.trim();
    if (raw === "") {
      (target as CurveStyle).dash = [];
    } else {
      const parts = raw.split(",").map((s) => parseFloat(s.trim()));
      if (parts.some((n) => isNaN(n) || n < 0)) return;
      (target as CurveStyle).dash = parts;
    }
    draw();
  });
  opacityIn.addEventListener("input", (e) => {
    if (!target) return;
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0 && v <= 1) { (target as PointsStyle).opacity = v; draw(); }
  });
}
