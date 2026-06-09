#!/usr/bin/env node
/// <reference types="node" />
// svg-path-to-json.ts — CLI wrapper around svg-path-import.ts
// Usage: npx tsx svg-path-to-json.ts resources/figure-1-1-cat.svg
// Outputs JSON to stdout, ready to paste into the editor via "Paste JSON".

import { readFileSync } from 'fs';
import { svgFileToSegments } from './svg-path-import';

const file: string | undefined = process.argv[2];
if (!file) { console.error('Usage: npx tsx svg-path-to-json.ts <file.svg>'); process.exit(1); }

const segs = svgFileToSegments(readFileSync(file, 'utf8'));
if (!segs) { console.error('No supported path found in SVG.'); process.exit(1); }

// Single segment → flat [[x,y],...], multiple → [[[x,y],...],...]
console.log(JSON.stringify(segs.length === 1 ? segs[0] : segs));
