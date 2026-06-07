#!/usr/bin/env node
// svg-path-to-json.mjs
// Parses straight-line SVG path commands (m/M/l/L/h/H/v/V/z/Z) into
// the demo JSON format: [[x,y], ...] (one segment).
//
// Usage:
//   node svg-path-to-json.mjs resources/figure-1-1-cat.svg
//
// Outputs JSON to stdout, ready to paste into the demo via "Paste JSON".

import { readFileSync } from 'fs';

const file = process.argv[2];
if (!file) { console.error('Usage: node svg-path-to-json.mjs <file.svg>'); process.exit(1); }

const svg  = readFileSync(file, 'utf8');
const match = svg.match(/\sd="([^"]+)"/);
if (!match) { console.error('No d="..." path found in SVG.'); process.exit(1); }

const points = parsePath(match[1]);
console.log(JSON.stringify(points));

// ---------------------------------------------------------------------------

function parsePath(d) {
  // Tokenise into command letters and numbers.
  const re = /([MmLlHhVvZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const tokens = [];
  for (const m of d.matchAll(re))
    tokens.push(m[1] ?? parseFloat(m[2]));

  const pts = [];
  let x = 0, y = 0;   // current point
  let x0 = 0, y0 = 0; // subpath start (for Z)
  let cmd = null;
  let i = 0;

  const push = (px, py) => { x = px; y = py; pts.push([+px.toFixed(4), +py.toFixed(4)]); };

  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];

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
      default:
        // Unknown command or leftover number — skip one token.
        console.error(`Warning: unsupported token "${tokens[i - 1] ?? cmd}", skipping`);
        i++;
    }
  }

  // Drop duplicate consecutive points (e.g. from "v 0").
  return pts.filter(([px, py], k) =>
    k === 0 || px !== pts[k-1][0] || py !== pts[k-1][1]);
}
