/**
 * Minimal static renderer: GL-k control points → SVG.
 *
 * Renders a mod GL-1 curve by default.  Accepts the existing project JSON
 * format (simple segment array or the `{ segments, eta }` object form).
 *
 * Usage:
 *   import { render } from './glk-render';
 *   const svg = render([[[0,0],[100,50],[200,0]]]);
 *   // or with options:
 *   const svg = render(myJson, { stroke: '#000', strokeWidth: 1.5 });
 */

import { buildSVG } from './glk-svg';

// ---------------------------------------------------------------------------
// Input types — mirrors the project's existing JSON format
// ---------------------------------------------------------------------------

/**
 * Accepted input shapes:
 *   number[][][]         — array of segments (each is an array of [x, y] points)
 *   { segments, eta? }   — same with optional η override
 */
export type RenderInput =
  | number[][][]
  | { segments: number[][][]; eta?: number | null };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RenderOpts {
  /** Curve stroke color.  Default: '#333333'. */
  stroke?: string;
  /** Stroke width in SVG user units.  Default: 2. */
  strokeWidth?: number;
  /**
   * η tangent scaling override.
   *   undefined → inherit from input JSON, or auto (1/ω₀) if not present
   *   null      → auto (1/ω₀)
   *   number    → explicit value
   */
  eta?: number | null;
  /** Padding (in the same coordinate units as the points) around the
   *  auto-computed bounding box.  Default: 10. */
  padding?: number;
  /**
   * SVG background color/fill.
   *   undefined → no background (transparent SVG)
   *   string    → set as `style="background:…"` on the root element
   */
  background?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseInput(input: RenderInput): {
  segments: number[][][];
  eta: number | null | undefined;
} {
  if (Array.isArray(input)) return { segments: input, eta: undefined };
  return { segments: input.segments, eta: input.eta };
}

// ---------------------------------------------------------------------------
// render()
// ---------------------------------------------------------------------------

/**
 * Render GL-k control-point data as a mod GL-1 SVG curve.
 *
 * Chain handling: consecutive segments that share an endpoint (e.g. a curve
 * that was "split" in the editor) are joined into a single SVG `<path>` so
 * that the meeting point renders as a sharp corner rather than two round caps.
 *
 * @param input - control points in the project's JSON format
 * @param opts  - optional rendering overrides
 * @returns complete SVG document string
 */
export function render(input: RenderInput, opts: RenderOpts = {}): string {
  const {
    stroke      = '#333333',
    strokeWidth = 2,
    padding     = 10,
    background,
  } = opts;

  const { segments, eta: inputEta } = parseInput(input);
  // eta precedence: explicit opts > JSON value > auto (null)
  const eta = opts.eta !== undefined ? opts.eta : (inputEta ?? null);

  // Compute bounding box of all control points.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segments)
    for (const [x, y] of seg) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

  if (!isFinite(minX))
    return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>`;

  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + 2 * padding;
  const vbH = maxY - minY + 2 * padding;

  // buildSVG hard-codes viewBox="0 0 W H", so pass dimensions that encompass
  // all points (bottom-right of the bounding box + padding).  We replace the
  // viewBox afterwards with the tight crop.
  let svg = buildSVG(segments, {
    width:  maxX + padding,
    height: maxY + padding,
    showM1: true,
    eta,
    styles: { modGl1: { color: stroke, width: strokeWidth } },
  });

  // Patch viewBox to the tight bounding box.
  svg = svg.replace(
    /width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
    `width="${vbW}" height="${vbH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`,
  );

  // Patch background: replace or remove the editor's dark style.
  if (background) {
    svg = svg.replace(/style="background:[^"]*"/, `style="background:${background}"`);
  } else {
    svg = svg.replace(/ style="background:[^"]*"/, '');
  }

  return svg;
}
