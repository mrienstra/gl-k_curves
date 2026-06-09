import { initDraw, draw } from "./editor-draw";
import { setupInteraction } from "./editor-interact";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ── console-accessible globals ────────────────────────────────────────────────
// Closed-curve debug config.  Edit in devtools console, then call window.draw().
window.closedCurve = {
  copies:   3,     // how many times to tile the polygon for the extension
  showFull: false, // true → render entire extended sequence; false → middle copy only
};
window.draw = draw;

initDraw(canvas, ctx);
setupInteraction(canvas);

// ── sizing ───────────────────────────────────────────────────────────────────
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const previewOn = document.getElementById("chkSVGPreview").checked;
  const totalW = window.innerWidth - 200;
  const w = previewOn ? Math.floor(totalW / 2) : totalW;
  const h = window.innerHeight;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);
  draw();
}

document.getElementById("chkSVGPreview").addEventListener("change", (e) => {
  document.getElementById("svgPreview").style.display = e.target.checked
    ? "block"
    : "none";
  resize();
});

window.addEventListener("resize", resize);
resize();
