import { sampleGLK } from "./glk-curve.mjs";
import { sampleModifiedGLK } from "./glk-modified.mjs";
import {
  sampleGLKFractional,
  sampleModifiedGLKFractional,
} from "./glk-fractional.mjs";
import { buildSVG } from "./glk-svg.mjs";
import { state, isSelected } from "./editor-state.mjs";

let canvas, ctx;
export function initDraw(c, context) {
  canvas = c;
  ctx = context;
}

// ── primitives ───────────────────────────────────────────────────────────────
function drawCurve(samples, color, width = 2) {
  if (samples.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(samples[0][0], samples[0][1]);
  for (let i = 1; i < samples.length; i++)
    ctx.lineTo(samples[i][0], samples[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawPolygon(pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoints(pts, segIdx, isActive) {
  const { hover } = state;
  for (let i = 0; i < pts.length; i++) {
    const isSel = isSelected(segIdx, i);
    const isHov = hover && hover.s === segIdx && hover.i === i;
    ctx.beginPath();
    ctx.arc(
      pts[i][0],
      pts[i][1],
      isSel ? 7 : isActive || isHov ? 6 : 4,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = isSel
      ? "#0ff"
      : isHov
        ? "#ddd"
        : isActive
          ? i === 0 || i === pts.length - 1
            ? "#fa6"
            : "#aaa"
          : "#666";
    ctx.fill();
    if (isActive || isSel || isHov) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();
    }
  }
}

function updateSVGPreview() {
  const previewEl = document.getElementById("svgPreview");
  if (previewEl.style.display === "none") return;
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
  });
  previewEl.innerHTML = svg;
  const svgEl = previewEl.querySelector("svg");
  if (svgEl) {
    svgEl.setAttribute("width", "100%");
    svgEl.setAttribute("height", "100%");
  }
}

// ── main draw ────────────────────────────────────────────────────────────────
export function draw() {
  const { segments, activeSeg, selection, rectSelect } = state;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  if (!segments.some((s) => s.length > 0)) {
    ctx.fillStyle = "#555";
    ctx.fillText("Click to add control points", 20, 40);
  }

  const N = 300;
  const kFrac = parseFloat(document.getElementById("sldK").value);
  document.getElementById("kVal").textContent = kFrac.toFixed(2);
  const raw = parseFloat(document.getElementById("sldEta").value);
  const eta = raw === 0 ? null : raw;
  document.getElementById("etaVal").textContent =
    eta === null ? "auto" : raw.toFixed(1);
  const alpha = parseFloat(document.getElementById("sldAlpha").value);
  document.getElementById("alphaVal").textContent = alpha.toFixed(2);

  for (let s = 0; s < segments.length; s++) {
    const pts = segments[s];
    if (pts.length < 2) continue;
    if (document.getElementById("chkPoly").checked) drawPolygon(pts);
    try {
      if (document.getElementById("chk0").checked)
        drawCurve(sampleGLK(pts, 0, N), "#f97");
      if (document.getElementById("chk1").checked && pts.length >= 2)
        drawCurve(sampleGLK(pts, 1, N), "#7bf");
      if (document.getElementById("chk2").checked && pts.length >= 3)
        drawCurve(sampleGLK(pts, 2, N), "#8f8");
      if (document.getElementById("chkFrac").checked && pts.length >= 2) {
        ctx.setLineDash([8, 3]);
        const fracSampler =
          document.getElementById("chkFracMod").checked && pts.length >= 4
            ? sampleModifiedGLKFractional(pts, kFrac, N, eta, eta, alpha)
            : sampleGLKFractional(pts, kFrac, N);
        drawCurve(fracSampler, "#fff", 1.5);
        ctx.setLineDash([]);
      }
      if (document.getElementById("chkM0").checked && pts.length >= 4)
        drawCurve(sampleModifiedGLK(pts, 0, N, eta, eta, alpha), "#f5c", 2);
      if (document.getElementById("chkM1").checked && pts.length >= 4)
        drawCurve(sampleModifiedGLK(pts, 1, N, eta, eta, alpha), "#fc6", 2.5);
    } catch (e) {
      ctx.fillStyle = "#f66";
      ctx.fillText(e.message, 10, 20);
    }
  }

  if (document.getElementById("chkPoly").checked)
    for (let s = 0; s < segments.length; s++)
      drawPoints(segments[s], s, s === activeSeg);

  if (rectSelect) {
    const rx = Math.min(rectSelect.x0, rectSelect.x1);
    const ry = Math.min(rectSelect.y0, rectSelect.y1);
    const rw = Math.abs(rectSelect.x1 - rectSelect.x0);
    const rh = Math.abs(rectSelect.y1 - rectSelect.y0);
    ctx.strokeStyle = "#5af";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(85,170,255,0.06)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  document.getElementById("segInfo").textContent =
    selection.size > 0
      ? `${selection.size} pts — Seg ${activeSeg + 1}/${segments.length}`
      : `Seg ${activeSeg + 1} / ${segments.length}`;
  updateSVGPreview();
}
