import { sampleGLK } from "./glk-curve";
import {
  sampleGLKClosed,
  sampleGLKFractionalClosed,
  sampleModifiedGLKClosed,
  sampleModifiedGLKFractionalClosed,
} from "./glk-closed";
import { sampleModifiedGLK } from "./glk-modified";
import {
  sampleGLKFractional,
  sampleModifiedGLKFractional,
} from "./glk-fractional";
import { buildSVG } from "./glk-svg";
import { state, isSelected, curveStyles, getClosedOpts } from "./editor-state";

let canvas!: HTMLCanvasElement;
let ctx!: CanvasRenderingContext2D;
export function initDraw(c: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  canvas = c;
  ctx = context;
}

// ── primitives ───────────────────────────────────────────────────────────────
function drawCurve(samples: number[][], color: string, width = 2, dash: number[] = [], close = false): void {
  if (samples.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(samples[0][0], samples[0][1]);
  for (let i = 1; i < samples.length; i++)
    ctx.lineTo(samples[i][0], samples[i][1]);
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPolygon(pts: number[][], closed = false): void {
  if (pts.length < 2) return;
  const inv = 1 / state.viewport.scale;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = inv;
  ctx.setLineDash([4 * inv, 4 * inv]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoints(pts: number[][], segIdx: number, isActive: boolean): void {
  const { hover } = state;
  const inv = 1 / state.viewport.scale;
  ctx.globalAlpha = curveStyles.points.opacity;
  for (let i = 0; i < pts.length; i++) {
    const isSel = isSelected(segIdx, i);
    const isHov = hover && hover.s === segIdx && hover.i === i;
    ctx.beginPath();
    ctx.arc(
      pts[i][0],
      pts[i][1],
      (isSel ? 7 : isActive || isHov ? 6 : 4) * inv,
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
      ctx.lineWidth = (isSel ? 2 : 1) * inv;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function updateSVGPreview(): void {
  const previewEl = document.getElementById("svgPreview") as HTMLElement;
  if (previewEl.style.display === "none") return;
  const rawEta = parseFloat((document.getElementById("sldEta") as HTMLInputElement).value);
  const svg = buildSVG(state.segments, {
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    showGL0: (document.getElementById("chk0") as HTMLInputElement).checked,
    showGL1: (document.getElementById("chk1") as HTMLInputElement).checked,
    showGL2: (document.getElementById("chk2") as HTMLInputElement).checked,
    showM1: (document.getElementById("chkM1") as HTMLInputElement).checked,
    showFrac: (document.getElementById("chkFrac") as HTMLInputElement).checked,
    showFracMod: (document.getElementById("chkFracMod") as HTMLInputElement).checked,
    showPoly: (document.getElementById("chkPoly") as HTMLInputElement).checked,
    kFrac: parseFloat((document.getElementById("sldK") as HTMLInputElement).value),
    eta: rawEta === 0 ? null : rawEta,
    alpha: parseFloat((document.getElementById("sldAlpha") as HTMLInputElement).value),
    styles: { gl0: curveStyles.gl0, gl1: curveStyles.gl1, gl2: curveStyles.gl2, modGl1: curveStyles.modGl1, frac: curveStyles.frac },
    closedSet: state.closed,
    closedOptsMap: state.closedOpts,
    simplify: (document.getElementById("chkSimplify") as HTMLInputElement).checked,
  });
  previewEl.innerHTML = svg;
  const svgEl = previewEl.querySelector("svg");
  if (svgEl) {
    svgEl.setAttribute("width", "100%");
    svgEl.setAttribute("height", "100%");
  }
}

// ── main draw ────────────────────────────────────────────────────────────────
export function draw(): void {
  const { segments, activeSeg, selection, rectSelect } = state;
  const { x: vpX, y: vpY, scale } = state.viewport;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.save();
  ctx.transform(scale, 0, 0, scale, vpX, vpY);

  if (!segments.some((s) => s.length > 0)) {
    ctx.fillStyle = "#555";
    ctx.fillText("Click to add control points", 20 / scale, 40 / scale);
  }

  const N = 300;
  const kFrac = parseFloat((document.getElementById("sldK") as HTMLInputElement).value);
  document.getElementById("kVal")!.textContent = kFrac.toFixed(2);
  const raw = parseFloat((document.getElementById("sldEta") as HTMLInputElement).value);
  const eta = raw === 0 ? null : raw;
  document.getElementById("etaVal")!.textContent =
    eta === null ? "auto" : raw.toFixed(1);
  const alpha = parseFloat((document.getElementById("sldAlpha") as HTMLInputElement).value);
  document.getElementById("alphaVal")!.textContent = alpha.toFixed(2);

  for (let s = 0; s < segments.length; s++) {
    const pts = segments[s];
    if (pts.length < 2) continue;
    const isClosed = state.closed.has(s);
    if ((document.getElementById("chkPoly") as HTMLInputElement).checked) drawPolygon(pts, isClosed);
    try {
      if (isClosed) {
        // Closed curve: use periodic extension.
        const closedOpts = getClosedOpts(s);
        // Don't ctx.closePath() when showFull — the extended sequence doesn't close.
        const closePath = !closedOpts.showFull;
        if ((document.getElementById("chk0") as HTMLInputElement).checked)
          drawCurve(sampleGLKClosed(pts, 0, N, closedOpts), curveStyles.gl0.color, curveStyles.gl0.width, curveStyles.gl0.dash, closePath);
        if ((document.getElementById("chk1") as HTMLInputElement).checked)
          drawCurve(sampleGLKClosed(pts, 1, N, closedOpts), curveStyles.gl1.color, curveStyles.gl1.width, curveStyles.gl1.dash, closePath);
        if ((document.getElementById("chk2") as HTMLInputElement).checked && pts.length >= 3)
          drawCurve(sampleGLKClosed(pts, 2, N, closedOpts), curveStyles.gl2.color, curveStyles.gl2.width, curveStyles.gl2.dash, closePath);
        if ((document.getElementById("chkFrac") as HTMLInputElement).checked && pts.length >= 3) {
          const fracSampler =
            (document.getElementById("chkFracMod") as HTMLInputElement).checked
              ? sampleModifiedGLKFractionalClosed(pts, kFrac, N, eta, eta, alpha, closedOpts)
              : sampleGLKFractionalClosed(pts, kFrac, N, closedOpts);
          drawCurve(fracSampler, curveStyles.frac.color, curveStyles.frac.width, curveStyles.frac.dash, closePath);
        }
        if ((document.getElementById("chkM1") as HTMLInputElement).checked && pts.length >= 3)
          drawCurve(sampleModifiedGLKClosed(pts, 1, N, eta, eta, alpha, closedOpts), curveStyles.modGl1.color, curveStyles.modGl1.width, curveStyles.modGl1.dash, closePath);
      } else {
        if ((document.getElementById("chk0") as HTMLInputElement).checked)
          drawCurve(sampleGLK(pts, 0, N), curveStyles.gl0.color, curveStyles.gl0.width, curveStyles.gl0.dash);
        if ((document.getElementById("chk1") as HTMLInputElement).checked && pts.length >= 2)
          drawCurve(sampleGLK(pts, 1, N), curveStyles.gl1.color, curveStyles.gl1.width, curveStyles.gl1.dash);
        if ((document.getElementById("chk2") as HTMLInputElement).checked && pts.length >= 3)
          drawCurve(sampleGLK(pts, 2, N), curveStyles.gl2.color, curveStyles.gl2.width, curveStyles.gl2.dash);
        if ((document.getElementById("chkFrac") as HTMLInputElement).checked && pts.length >= 2) {
          const fracSampler =
            (document.getElementById("chkFracMod") as HTMLInputElement).checked && pts.length >= 4
              ? sampleModifiedGLKFractional(pts, kFrac, N, eta, eta, alpha)
              : sampleGLKFractional(pts, kFrac, N);
          drawCurve(fracSampler, curveStyles.frac.color, curveStyles.frac.width, curveStyles.frac.dash);
        }
        if ((document.getElementById("chkM1") as HTMLInputElement).checked && pts.length >= 4)
          drawCurve(sampleModifiedGLK(pts, 1, N, eta, eta, alpha), curveStyles.modGl1.color, curveStyles.modGl1.width, curveStyles.modGl1.dash);
      }
    } catch (e) {
      ctx.fillStyle = "#f66";
      ctx.fillText((e as Error).message, 10, 20);
    }
  }

  if ((document.getElementById("chkPoly") as HTMLInputElement).checked)
    for (let s = 0; s < segments.length; s++)
      drawPoints(segments[s], s, s === activeSeg);

  // Edge-insert preview: small open circle at projected position
  const { hoverEdge } = state;
  const inv = 1 / scale;
  if (hoverEdge && !state.drag && !rectSelect) {
    ctx.beginPath();
    ctx.arc(hoverEdge.px, hoverEdge.py, 5 * inv, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5 * inv;
    ctx.stroke();
  }

  if (rectSelect) {
    const rx = Math.min(rectSelect.x0, rectSelect.x1);
    const ry = Math.min(rectSelect.y0, rectSelect.y1);
    const rw = Math.abs(rectSelect.x1 - rectSelect.x0);
    const rh = Math.abs(rectSelect.y1 - rectSelect.y0);
    ctx.strokeStyle = "#5af";
    ctx.lineWidth = inv;
    ctx.setLineDash([4 * inv, 2 * inv]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(85,170,255,0.06)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  ctx.restore();

  // Update split / join button label and enabled state
  const btn = document.getElementById("btnSplit") as HTMLButtonElement;
  const selArr = [...selection].map((k) => {
    const [s, i] = k.split(":").map(Number);
    return { s, i };
  });
  if (selArr.length === 1) {
    const { s, i } = selArr[0];
    btn.textContent = "Split at selected";
    btn.disabled = i === 0 || i === segments[s].length - 1;
  } else if (selArr.length === 2) {
    const [{ s: s1, i: i1 }, { s: s2, i: i2 }] = selArr;
    const pts1 = segments[s1], pts2 = segments[s2];
    const ep1 = i1 === 0 || i1 === pts1.length - 1;
    const ep2 = i2 === 0 || i2 === pts2.length - 1;
    const dist = Math.hypot(pts1[i1][0] - pts2[i2][0], pts1[i1][1] - pts2[i2][1]);
    if (s1 === s2) {
      const isFirstLast = ep1 && ep2 && i1 !== i2 &&
        ((i1 === 0 && i2 === pts1.length - 1) || (i2 === 0 && i1 === pts1.length - 1));
      btn.textContent = state.closed.has(s1) ? "Open segment" : "Close segment";
      btn.disabled = !isFirstLast || dist >= 10;
    } else {
      btn.textContent = "Join selected";
      btn.disabled = !ep1 || !ep2 || dist >= 10;
    }
  } else {
    btn.textContent = "Split at selected";
    btn.disabled = true;
  }

  document.getElementById("segInfo")!.textContent =
    selection.size > 0
      ? `${selection.size} pts — Seg ${activeSeg + 1}/${segments.length}`
      : `Seg ${activeSeg + 1} / ${segments.length}`;

  document.getElementById("btnClosedOpts")!.style.display =
    state.closed.has(activeSeg) ? "" : "none";
  updateSVGPreview();
}
