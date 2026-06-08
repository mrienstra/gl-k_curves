import { initDraw, draw }    from './demo-draw.mjs';
import { setupInteraction }  from './demo-interact.mjs';

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

initDraw(canvas, ctx);
setupInteraction(canvas);

// ── sizing ───────────────────────────────────────────────────────────────────
function resize() {
  const dpr       = window.devicePixelRatio || 1;
  const previewOn = document.getElementById('chkSVGPreview').checked;
  const totalW    = window.innerWidth - 200;
  const w         = previewOn ? Math.floor(totalW / 2) : totalW;
  const h         = window.innerHeight;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);
  draw();
}

document.getElementById('chkSVGPreview').addEventListener('change', e => {
  document.getElementById('svgPreview').style.display = e.target.checked ? 'block' : 'none';
  resize();
});

window.addEventListener('resize', resize);
resize();
