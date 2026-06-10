/**
 * GL-k path format renderer.
 *
 * Accepts a <glk:path> element (as an XML string or an attribute object) and
 * renders it as a standard SVG document.
 *
 * Input format: see glk-path-format.md
 *
 * Usage:
 *   import { renderGLKPath } from './glk-render-path';
 *
 *   // From a <glk:path> element string:
 *   const svg = renderGLKPath('<glk:path k="1" modified="true" stroke="#333" d="M 0,0 L 100,50 L 200,0"/>');
 *
 *   // From an attribute object:
 *   const svg = renderGLKPath({ d: 'M 0,0 L 100,50 L 200,0', stroke: '#333' });
 */

import { buildSVG } from './glk-svg';

// ---------------------------------------------------------------------------
// Path data parser
// ---------------------------------------------------------------------------

function parseNums(s: string): number[] {
  const out: number[] = [];
  const re = /-?[\d.]+(?:[eE][+-]?\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(Number(m[0]));
  return out;
}

/**
 * Parse the `d=` attribute of a <glk:path> element into GL-k segments.
 *
 * Commands recognised:
 *   M x,y [x,y …]   start a new segment; subsequent pairs are implicit lineto
 *   L x,y [x,y …]   add control point(s) to the current segment
 *   m 0,0            segment-break marker (deprecated in favour of M; still handled)
 *   Z / z            close current segment (periodic GL-k curve)
 *
 * Sharp corners are encoded by a mid-path M whose coordinate equals the last
 * drawn point of the preceding segment.  buildSVG's buildChains() detects this
 * automatically — no special handling is needed here.
 *
 * @returns segments and a Set of closed-segment indices (for buildSVG)
 */
export function parsePath(d: string): {
  segments: number[][][];
  closedSet: Set<number>;
} {
  const segments: number[][][] = [];
  const closedSet = new Set<number>();
  let current: number[][] = [];

  const cmdRe = /([MLmZz])((?:[^MLmZz])*)/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRe.exec(d)) !== null) {
    const cmd   = match[1];
    const nums  = parseNums(match[2]);

    if (cmd === 'M') {
      // Save previous segment (if any), start a new one.
      if (current.length > 0) { segments.push(current); current = []; }
      // M x,y + implicit subsequent lineto pairs
      for (let i = 0; i + 1 < nums.length; i += 2)
        current.push([nums[i], nums[i + 1]]);

    } else if (cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2)
        current.push([nums[i], nums[i + 1]]);

    } else if (cmd === 'm') {
      // m 0,0 — segment-break marker; accept but don't add a point.
      // Non-zero relative moves are not part of the format; ignore them.
      for (let i = 0; i + 1 < nums.length; i += 2) {
        if (nums[i] === 0 && nums[i + 1] === 0 && current.length > 0) {
          const last = current[current.length - 1];
          segments.push(current);
          current = [[...last]]; // new segment starts at the same point
        }
      }

    } else if (cmd === 'Z' || cmd === 'z') {
      if (current.length > 0) {
        // buildSVG expects closed segments to have the first point duplicated
        // at the end (its closedPathDWithMatrix drops the trailing copy).
        current.push([...current[0]]);
        closedSet.add(segments.length);
        segments.push(current);
        current = [];
      }
    }
  }

  if (current.length > 0) segments.push(current);
  return { segments, closedSet };
}

// ---------------------------------------------------------------------------
// Attribute types
// ---------------------------------------------------------------------------

/** Attributes of a <glk:path> element. */
export interface GLKPathAttrs {
  /** SVG path d= string — control points as M/L/Z commands */
  d: string;
  /** GL order (default 1; fractional values accepted) */
  k?: number;
  /** Apply tangent correction — Section 6 of the paper (default true) */
  modified?: boolean;
  /** η tangent scaling; null = auto 1/ω₀ (default null) */
  eta?: number | null;
  /** Tangent correction blend α — 0 = none, 1 = full (default 1) */
  alpha?: number;
  /** SVG stroke color */
  stroke?: string;
  /** SVG stroke width in user units */
  strokeWidth?: number;
}

/** Rendering options independent of the path data. */
export interface GLKPathRenderOpts {
  /** Padding around the auto-computed bounding box (default 10) */
  padding?: number;
  /** SVG background color; omit for transparent */
  background?: string;
}

// ---------------------------------------------------------------------------
// XML element parser (minimal — handles well-formed <glk:path … /> strings)
// ---------------------------------------------------------------------------

function parseElementAttrs(xml: string): GLKPathAttrs {
  const raw: Record<string, string> = {};
  const re = /([\w:-]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) raw[m[1]] = m[2];

  return {
    d:           raw.d ?? '',
    k:           raw.k           != null ? Number(raw.k)                              : undefined,
    modified:    raw.modified    != null ? raw.modified !== 'false'                   : undefined,
    eta:         raw.eta         != null ? (raw.eta === 'auto' ? null : Number(raw.eta)) : undefined,
    alpha:       raw.alpha       != null ? Number(raw.alpha)                          : undefined,
    stroke:      raw.stroke,
    strokeWidth: raw['stroke-width'] != null ? Number(raw['stroke-width'])            : undefined,
  };
}

// ---------------------------------------------------------------------------
// buildSVG option mapping
// ---------------------------------------------------------------------------

/**
 * Map k / modified flags to the corresponding buildSVG visibility + style opts.
 *
 * buildSVG supports:
 *   showGL0 / showGL1 / showGL2  — integer GL-k without modification
 *   showM1                       — modified GL-1 (the main use case)
 *   showFrac + kFrac             — fractional k, with or without modification
 *
 * For modified GL-k with integer k ≠ 1 the format is valid but buildSVG has
 * no direct flag; we fall back to showFrac + showFracMod which uses the same
 * applyTangentOperator code path.
 */
function svgOpts(
  k: number, modified: boolean,
  eta: number | null, alpha: number,
  stroke: string, sw: number,
  width: number, height: number,
  closedSet: Set<number>,
) {
  const base = { width, height, eta, alpha, closedSet };

  if (modified && k === 1)
    return { ...base, showM1: true,
             styles: { modGl1: { color: stroke, width: sw } } };

  if (!modified && Number.isInteger(k)) {
    if (k === 0) return { ...base, showGL0: true, styles: { gl0: { color: stroke, width: sw } } };
    if (k === 1) return { ...base, showGL1: true, styles: { gl1: { color: stroke, width: sw } } };
    if (k === 2) return { ...base, showGL2: true, styles: { gl2: { color: stroke, width: sw } } };
  }

  // Fractional k, or integer k > 2, or modified k ≠ 1
  return { ...base, showFrac: true, showFracMod: modified, kFrac: k,
           styles: { frac: { color: stroke, width: sw } } };
}

// ---------------------------------------------------------------------------
// renderGLKPath()
// ---------------------------------------------------------------------------

/**
 * Render a GL-k path as a complete SVG document.
 *
 * @param input  - either a `<glk:path …/>` XML string or an attribute object
 * @param opts   - rendering options (padding, background)
 * @returns complete SVG document string
 */
export function renderGLKPath(
  input: string | GLKPathAttrs,
  opts: GLKPathRenderOpts = {},
): string {
  // Merge defaults with provided attributes
  const raw = typeof input === 'string' ? parseElementAttrs(input) : input;
  const k           = raw.k           ?? 1;
  const modified    = raw.modified    ?? true;
  const eta         = raw.eta         !== undefined ? raw.eta : null;
  const alpha       = raw.alpha       ?? 1;
  const stroke      = raw.stroke      ?? '#333333';
  const strokeWidth = raw.strokeWidth ?? 2;

  const { padding = 10, background } = opts;

  // Parse path data
  const { segments, closedSet } = parsePath(raw.d);

  // Bounding box of all control points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segments)
    for (const [x, y] of seg) {
      if (x < minX) minX = x;  if (x > maxX) maxX = x;
      if (y < minY) minY = y;  if (y > maxY) maxY = y;
    }

  if (!isFinite(minX))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;

  const vbX = minX - padding, vbY = minY - padding;
  const vbW = maxX - minX + 2 * padding, vbH = maxY - minY + 2 * padding;

  // buildSVG requires dimensions ≥ max coordinate; we crop via viewBox afterwards
  let svg = buildSVG(
    segments,
    svgOpts(k, modified, eta, alpha, stroke, strokeWidth,
            maxX + padding, maxY + padding, closedSet),
  );

  // Patch viewBox to the tight bounding box
  svg = svg.replace(
    /width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
    `width="${vbW}" height="${vbH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`,
  );

  // Background
  if (background)
    svg = svg.replace(/style="background:[^"]*"/, `style="background:${background}"`);
  else
    svg = svg.replace(/ style="background:[^"]*"/, '');

  return svg;
}
