// svg-path-import.mjs
// Parse SVG path d attributes (straight-line commands: M/m/L/l/H/h/V/v/Z/z).
// Bezier/arc commands are silently skipped — those tokens are consumed but produce no points.

// Parse a single SVG path d string → [[x,y], ...]
export function parseSVGPathD(d) {
  const re = /([MmLlHhVvZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const tokens = [];
  for (const m of d.matchAll(re)) tokens.push(m[1] ?? parseFloat(m[2]));

  const pts = [];
  let x = 0, y = 0, x0 = 0, y0 = 0, cmd = null, i = 0;

  const push = (px, py) => { x = px; y = py; pts.push([px, py]); };
  // How many coord args each unsupported command consumes per implicit repeat:
  const SKIP = { C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7 };

  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];
    if (cmd in SKIP) { i += SKIP[cmd]; continue; }
    switch (cmd) {
      case 'M': push(tokens[i++], tokens[i++]); x0 = x; y0 = y; cmd = 'L'; break;
      case 'm': push(x + tokens[i++], y + tokens[i++]); x0 = x; y0 = y; cmd = 'l'; break;
      case 'L': push(tokens[i++], tokens[i++]); break;
      case 'l': push(x + tokens[i++], y + tokens[i++]); break;
      case 'H': push(tokens[i++], y); break;
      case 'h': push(x + tokens[i++], y); break;
      case 'V': push(x, tokens[i++]); break;
      case 'v': push(x, y + tokens[i++]); break;
      case 'Z': case 'z': push(x0, y0); break;
      default: i++;
    }
  }

  // Drop consecutive duplicate points (e.g. from "v 0")
  return pts.filter(([px, py], k) => k === 0 || px !== pts[k-1][0] || py !== pts[k-1][1]);
}

// Parse an SVG string → array of segments (one per <path>), fitted to canvas.
// Returns [[[x,y],...], ...], or null if no paths found.
export function svgFileToSegments(svgText, { width, height, padding = 40 } = {}) {
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  let srcX = 0, srcY = 0, srcW = null, srcH = null;
  if (vbMatch) {
    [srcX, srcY, srcW, srcH] = vbMatch[1].trim().split(/[\s,]+/).map(Number);
  } else {
    const wm = svgText.match(/\bwidth="([\d.]+)"/);
    const hm = svgText.match(/\bheight="([\d.]+)"/);
    if (wm) srcW = parseFloat(wm[1]);
    if (hm) srcH = parseFloat(hm[1]);
  }

  const paths = [...svgText.matchAll(/\sd="([^"]+)"/g)]
    .map(m => parseSVGPathD(m[1]))
    .filter(seg => seg.length > 0);

  if (!paths.length) return null;

  if (width && height && srcW && srcH) {
    const scale = Math.min(
      (width  - 2 * padding) / srcW,
      (height - 2 * padding) / srcH,
    );
    const offX = padding + ((width  - 2 * padding) - srcW * scale) / 2 - srcX * scale;
    const offY = padding + ((height - 2 * padding) - srcH * scale) / 2 - srcY * scale;
    return paths.map(seg => seg.map(([px, py]) => [px * scale + offX, py * scale + offY]));
  }

  return paths;
}
