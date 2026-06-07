#!/usr/bin/env python3

import argparse
import base64
import csv
import math
from pathlib import Path

import cv2
import numpy as np
from scipy import ndimage as ndi


def parse_args():
    p = argparse.ArgumentParser(
        description="Recover dot-like sample points from a blue raster path."
    )
    p.add_argument("input", help="Input image path")
    p.add_argument("--outdir", default="out_points", help="Output directory")
    p.add_argument("--min-radius", type=float, default=2.0,
                   help="Minimum distance-transform peak to count as a dot")
    p.add_argument("--peak-window", type=int, default=9,
                   help="Window size for local-max peak detection")
    p.add_argument("--merge-dist", type=float, default=8.0,
                   help="Merge nearby peak centers within this many pixels")
    p.add_argument("--max-edge", type=float, default=70.0,
                   help="Max distance allowed when connecting two nearby dots")
    p.add_argument("--support-threshold", type=float, default=0.82,
                   help="Fraction of sampled pixels along a segment that must stay inside blue mask")
    p.add_argument("--max-degree", type=int, default=3,
                   help="Max graph degree for a point")
    return p.parse_args()


def ensure_odd(n: int) -> int:
    return n if n % 2 == 1 else n + 1


def blue_mask(img_bgr):
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # Blue-ish threshold for OpenCV hue range [0,179]
    mask = (
        (h >= 85) & (h <= 140) &
        (s >= 45) &
        (v >= 40)
    ).astype(np.uint8) * 255

    # Clean small specks while preserving round "dot" bulges
    mask = cv2.medianBlur(mask, 5)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=1)

    return mask


def merge_points(points, merge_dist):
    if not points:
        return []

    pts = np.array(points, dtype=float)  # x, y, score
    used = np.zeros(len(pts), dtype=bool)
    merged = []

    for i in range(len(pts)):
        if used[i]:
            continue

        cluster = [i]
        used[i] = True
        changed = True

        while changed:
            changed = False
            current = pts[cluster, :2].mean(axis=0)
            for j in range(len(pts)):
                if used[j]:
                    continue
                if np.linalg.norm(pts[j, :2] - current) <= merge_dist:
                    used[j] = True
                    cluster.append(j)
                    changed = True

        sub = pts[cluster]
        weights = np.maximum(sub[:, 2], 1e-6)
        x = np.average(sub[:, 0], weights=weights)
        y = np.average(sub[:, 1], weights=weights)
        score = sub[:, 2].max()
        merged.append((float(x), float(y), float(score)))

    return merged


def detect_dot_centers(mask, min_radius=2.0, peak_window=9, merge_dist=8.0):
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)

    # Threshold the distance transform: pixels with dist >= min_radius belong to
    # regions that are "thick enough" to be dots rather than connecting lines.
    # Each connected blob in this thresholded map should correspond to one dot.
    # (peak_window is kept as an argument for CLI compatibility but not used.)
    thick = (dist >= min_radius) & (mask > 0)
    labels, count = ndi.label(thick)
    points = []

    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        if len(xs) == 0:
            continue

        weights = dist[ys, xs]
        x = np.average(xs, weights=weights)
        y = np.average(ys, weights=weights)
        score = float(weights.max())
        points.append((x, y, score))

    points = merge_points(points, merge_dist)
    return points, dist


def sample_line(p1, p2, oversample=2):
    x1, y1 = p1
    x2, y2 = p2
    length = max(2, int(math.hypot(x2 - x1, y2 - y1) * oversample))
    xs = np.linspace(x1, x2, length)
    ys = np.linspace(y1, y2, length)
    return xs, ys


def segment_support(mask, p1, p2):
    xs, ys = sample_line(p1, p2, oversample=2)
    xi = np.clip(np.rint(xs).astype(int), 0, mask.shape[1] - 1)
    yi = np.clip(np.rint(ys).astype(int), 0, mask.shape[0] - 1)
    vals = mask[yi, xi] > 0
    return float(vals.mean())


def point_to_segment_distance(p, a, b):
    p = np.array(p, dtype=float)
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    ab = b - a
    denom = np.dot(ab, ab)
    if denom == 0:
        return float(np.linalg.norm(p - a)), 0.0
    t = np.dot(p - a, ab) / denom
    t = max(0.0, min(1.0, t))
    proj = a + t * ab
    return float(np.linalg.norm(p - proj)), float(t)


def has_intermediate_point(points, i, j, tol=6.0):
    a = points[i][:2]
    b = points[j][:2]
    for k in range(len(points)):
        if k == i or k == j:
            continue
        c = points[k][:2]
        d, t = point_to_segment_distance(c, a, b)
        if 0.15 < t < 0.85 and d < tol:
            return True
    return False


def build_graph(points, mask, max_edge=70.0, support_threshold=0.82, max_degree=3):
    n = len(points)
    candidates = []

    for i in range(n):
        for j in range(i + 1, n):
            p1 = points[i][:2]
            p2 = points[j][:2]
            d = math.hypot(p2[0] - p1[0], p2[1] - p1[1])

            if d < 4 or d > max_edge:
                continue

            support = segment_support(mask, p1, p2)
            if support < support_threshold:
                continue

            if has_intermediate_point(points, i, j, tol=6.0):
                continue

            candidates.append((d, -support, i, j))

    candidates.sort()
    degree = [0] * n
    edges = set()

    for _, _, i, j in candidates:
        if degree[i] >= max_degree or degree[j] >= max_degree:
            continue
        edges.add((i, j))
        degree[i] += 1
        degree[j] += 1

    return edges


def connected_components(n, edges):
    adj = {i: set() for i in range(n)}
    for a, b in edges:
        adj[a].add(b)
        adj[b].add(a)

    seen = set()
    comps = []

    for i in range(n):
        if i in seen:
            continue
        stack = [i]
        comp = []
        seen.add(i)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for nxt in adj[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        comps.append(comp)

    return comps, adj


def angle_score(prev_pt, cur_pt, candidate_pt):
    v1 = np.array(cur_pt) - np.array(prev_pt)
    v2 = np.array(candidate_pt) - np.array(cur_pt)
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 == 0 or n2 == 0:
        return -1.0
    return float(np.dot(v1, v2) / (n1 * n2))


def order_component(component, adj, points):
    comp_set = set(component)
    local_deg = {i: len(adj[i] & comp_set) for i in component}
    endpoints = [i for i in component if local_deg[i] == 1]

    start = endpoints[0] if endpoints else min(component)
    used_edges = set()
    ordered_lines = []

    def edge_key(a, b):
        return (a, b) if a < b else (b, a)

    while True:
        remaining = [
            edge_key(a, b)
            for a in component
            for b in (adj[a] & comp_set)
            if a < b and edge_key(a, b) not in used_edges
        ]
        if not remaining:
            break

        if endpoints:
            candidates = []
            for ep in endpoints:
                unused = [n for n in (adj[ep] & comp_set) if edge_key(ep, n) not in used_edges]
                if unused:
                    candidates.append(ep)
            current = candidates[0] if candidates else start
        else:
            current = None
            for a, b in remaining:
                current = a
                break

        line = [current]
        prev = None

        while True:
            nbrs = [
                n for n in (adj[current] & comp_set)
                if edge_key(current, n) not in used_edges and n != prev
            ]

            if not nbrs:
                if prev is not None:
                    fallback = [
                        n for n in (adj[current] & comp_set)
                        if edge_key(current, n) not in used_edges
                    ]
                    if fallback:
                        nbrs = fallback
                    else:
                        break
                else:
                    break

            if prev is None:
                nxt = min(
                    nbrs,
                    key=lambda n: math.hypot(
                        points[n][0] - points[current][0],
                        points[n][1] - points[current][1]
                    )
                )
            else:
                nxt = max(
                    nbrs,
                    key=lambda n: angle_score(points[prev][:2], points[current][:2], points[n][:2])
                )

            used_edges.add(edge_key(current, nxt))
            line.append(nxt)
            prev, current = current, nxt

        if len(line) >= 2:
            ordered_lines.append(line)
        else:
            break

    return ordered_lines


def write_csv(path, points):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "x", "y", "score"])
        for idx, (x, y, score) in enumerate(points, start=1):
            w.writerow([idx, round(x, 2), round(y, 2), round(score, 3)])


def polyline_to_svg_path(points, polyline):
    if not polyline:
        return ""
    coords = [points[i][:2] for i in polyline]
    parts = [f"M {coords[0][0]:.2f} {coords[0][1]:.2f}"]
    for x, y in coords[1:]:
        parts.append(f"L {x:.2f} {y:.2f}")
    return " ".join(parts)


def write_svg(path, width, height, points, polylines):
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        '<rect width="100%" height="100%" fill="white"/>'
    ]

    for poly in polylines:
        d = polyline_to_svg_path(points, poly)
        lines.append(
            f'<path d="{d}" fill="none" stroke="#222" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        )

    for idx, (x, y, score) in enumerate(points, start=1):
        lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="3.5" fill="#d22"/>')
        lines.append(f'<text x="{x + 5:.2f}" y="{y - 5:.2f}" font-size="10" fill="#d22">{idx}</text>')

    lines.append("</svg>")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_overlay(path, original, mask, points, edges):
    overlay = original.copy()

    mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
    overlay = cv2.addWeighted(overlay, 0.72, mask_bgr, 0.28, 0)

    for a, b in edges:
        x1, y1 = points[a][:2]
        x2, y2 = points[b][:2]
        cv2.line(
            overlay,
            (int(round(x1)), int(round(y1))),
            (int(round(x2)), int(round(y2))),
            (20, 20, 20),
            1,
            lineType=cv2.LINE_AA
        )

    for idx, (x, y, score) in enumerate(points, start=1):
        cv2.circle(overlay, (int(round(x)), int(round(y))), 5, (0, 0, 255), 2, lineType=cv2.LINE_AA)
        cv2.putText(
            overlay,
            str(idx),
            (int(round(x + 6)), int(round(y - 6))),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (0, 0, 255),
            1,
            lineType=cv2.LINE_AA
        )

    cv2.imwrite(str(path), overlay)


def write_overlay_svg(path, img_path, width, height, points, edges):
    suffix = Path(img_path).suffix.lower()
    mime = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    b64 = base64.b64encode(Path(img_path).read_bytes()).decode("ascii")

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        f'<image href="data:{mime};base64,{b64}" x="0" y="0" width="{width}" height="{height}"/>',
    ]

    for a, b in edges:
        x1, y1 = points[a][:2]
        x2, y2 = points[b][:2]
        lines.append(
            f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}"'
            ' stroke="#111" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>'
        )

    for idx, (x, y, score) in enumerate(points, start=1):
        lines.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5"'
            ' fill="none" stroke="#d22" stroke-width="1.5"/>'
        )
        lines.append(
            f'<text x="{x + 7:.2f}" y="{y - 7:.2f}"'
            ' font-family="sans-serif" font-size="11" fill="#d22"'
            f' paint-order="stroke" stroke="white" stroke-width="2.5">{idx}</text>'
        )

    lines.append("</svg>")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    args = parse_args()

    inp = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    img = cv2.imread(str(inp), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Could not read image: {inp}")

    mask = blue_mask(img)
    points, dist = detect_dot_centers(
        mask,
        min_radius=args.min_radius,
        peak_window=args.peak_window,
        merge_dist=args.merge_dist
    )

    edges = build_graph(
        points,
        mask,
        max_edge=args.max_edge,
        support_threshold=args.support_threshold,
        max_degree=args.max_degree
    )

    components, adj = connected_components(len(points), edges)

    polylines = []
    for comp in components:
        if len(comp) == 1:
            continue
        polylines.extend(order_component(comp, adj, points))

    csv_path = outdir / "points.csv"
    svg_path = outdir / "points.svg"
    overlay_path = outdir / "overlay.png"
    overlay_svg_path = outdir / "overlay.svg"
    mask_path = outdir / "mask.png"

    write_csv(csv_path, points)
    write_svg(svg_path, img.shape[1], img.shape[0], points, polylines)
    write_overlay(overlay_path, img, mask, points, edges)
    write_overlay_svg(overlay_svg_path, inp, img.shape[1], img.shape[0], points, edges)
    cv2.imwrite(str(mask_path), mask)

    print(f"Detected {len(points)} points")
    print(f"CSV:          {csv_path}")
    print(f"SVG:          {svg_path}")
    print(f"Overlay PNG:  {overlay_path}")
    print(f"Overlay SVG:  {overlay_svg_path}")
    print(f"Mask:         {mask_path}")


if __name__ == "__main__":
    main()