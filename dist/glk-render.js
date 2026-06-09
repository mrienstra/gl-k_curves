import { svgPathSimplify as e } from "svg-path-simplify";
//#region gleval.ts
function t(e, t) {
	let i = e.length - 1;
	if (i < 0) throw Error("coeffs must be non-empty");
	let a = Array.isArray(e[0]);
	if (i === 0) return e[0];
	let o = 1, s = t, c = a ? n(e[0], r(t, e[1])) : e[0] + t * e[1];
	for (let l = 2; l <= i; l++) {
		let i = (2 * l - 1) / l, u = (l - 1) / l, d = i * t * s - u * o;
		a ? c = n(c, r(d, e[l])) : c += d * e[l], o = s, s = d;
	}
	return c;
}
function n(e, t) {
	return e.map((e, n) => e + t[n]);
}
function r(e, t) {
	return t.map((t) => e * t);
}
//#endregion
//#region gl-averaging.ts
function i(e) {
	let t = e.length, n = Array(t + 1);
	n[0] = e[0];
	for (let r = 1; r < t; r++) n[r] = o(e[r - 1], e[r]);
	return n[t] = e[t - 1], n;
}
function a(e, t) {
	let n = e;
	for (let e = 0; e < t; e++) n = i(n);
	return n;
}
function o(e, t) {
	return Array.isArray(e) ? e.map((e, n) => (e + t[n]) * .5) : (e + t) * .5;
}
//#endregion
//#region legendre.ts
function s(e, t) {
	if (e === 0) return {
		p: 1,
		dp: 0
	};
	if (e === 1) return {
		p: t,
		dp: 1
	};
	let n = 1, r = 0, i = t, a = 1;
	for (let o = 2; o <= e; o++) {
		let e = (2 * o - 1) / o, s = (o - 1) / o, c = e * t * i - s * n, l = e * (i + t * a) - s * r;
		n = i, r = a, i = c, a = l;
	}
	return {
		p: i,
		dp: a
	};
}
function c(e, t) {
	return s(e, t).p;
}
function l(e) {
	if (e === 0) return [];
	if (e === 1) return [0];
	let t = Array(e);
	for (let n = 0; n < Math.ceil(e / 2); n++) {
		let r = -Math.cos(Math.PI * (2 * n + 1) / (2 * e));
		for (let t = 0; t < 100; t++) {
			let { p: t, dp: n } = s(e, r), i = -t / n;
			if (r += i, Math.abs(i) < 1e-15) break;
		}
		t[n] = r, t[e - 1 - n] = -r;
	}
	return e % 2 == 1 && (t[(e - 1) / 2] = 0), t;
}
function u(e) {
	return l(e).map((t) => {
		let { dp: n } = s(e, t);
		return 2 / ((1 - t * t) * n * n);
	});
}
//#endregion
//#region gl0-legendre.ts
var d = /* @__PURE__ */ new Map();
function f(e, t, n, r) {
	if (e === -1) return t === 0 ? .5 : 0;
	if (e === n) return t === 0 ? -.5 : 0;
	let i = r[e];
	return t === n ? .5 * c(n - 1, i) : .5 * ((t === 0 ? 0 : c(t - 1, i)) - c(t + 1, i));
}
function p(e) {
	let t = d.get(e);
	if (t !== void 0) return t;
	let n = l(e), r = [];
	for (let t = 0; t <= e; t++) {
		let i = new Float64Array(e + 1);
		for (let r = 0; r <= e; r++) i[r] = f(r - 1, t, e, n) - f(r, t, e, n);
		r.push(i);
	}
	return d.set(e, r), r;
}
function m(e) {
	let t = e.length - 1, n = p(t), r = Array.isArray(e[0]);
	return n.map((n) => {
		if (!r) {
			let r = 0;
			for (let i = 0; i <= t; i++) r += n[i] * e[i];
			return r;
		}
		let i = e[0].length, a = Array(i).fill(0);
		for (let r = 0; r <= t; r++) for (let t = 0; t < i; t++) a[t] += n[r] * e[r][t];
		return a;
	});
}
//#endregion
//#region legendrereduce.ts
function h(e, t) {
	if (e === 0) return t.slice(0, t.length);
	let n = t.length - 1 - e, r = Array.isArray(t[0]), i = r ? Array(t[0].length).fill(0) : 0, a = r ? Array(t[0].length).fill(0) : 0;
	for (let o = 1; o <= e; o++) (n + o) % 2 == 0 ? i = g(i, t[n + o], r) : a = g(a, t[n + o], r);
	let o = n * (n + 1), s = (n + 1) * (n + 2);
	n % 2 == 0 ? (i = _(1 / s, i, r), a = _(1 / o, a, r)) : (i = _(1 / o, i, r), a = _(1 / s, a, r));
	let c = Array(n + 1);
	for (let e = 0; e <= n; e++) {
		let n = 4 * e + 2;
		c[e] = g(t[e], _(n, e % 2 == 0 ? i : a, r), r);
	}
	return c;
}
function g(e, t, n) {
	return n ? e.map((e, n) => e + t[n]) : e + t;
}
function _(e, t, n) {
	return n ? t.map((t) => e * t) : e * t;
}
//#endregion
//#region glk-curve.ts
function v(e, t = 1) {
	return h(t, m(a(e, t)));
}
//#endregion
//#region glk-matrix.ts
var y = /* @__PURE__ */ new Map();
function b(e, t) {
	let n = `${e},${t}`, r = y.get(n);
	if (r !== void 0) return r;
	let i = Array.from({ length: e + 1 }, () => new Float64Array(e + 1));
	for (let n = 0; n <= e; n++) {
		let r = Array(e + 1).fill(0);
		r[n] = 1;
		let a = v(r, t);
		for (let t = 0; t <= e; t++) i[t][n] = a[t];
	}
	return y.set(n, i), i;
}
function x(e, t) {
	let n = Array.isArray(t[0]);
	return e.map((e) => {
		if (!n) {
			let n = 0;
			for (let r = 0; r < e.length; r++) n += e[r] * t[r];
			return n;
		}
		let r = t[0].length, i = Array(r).fill(0);
		for (let n = 0; n < e.length; n++) for (let a = 0; a < r; a++) i[a] += e[n] * t[n][a];
		return i;
	});
}
//#endregion
//#region legendre-endpoints.ts
function S(e) {
	return e * (e + 1) / 2;
}
//#endregion
//#region glk-modified.ts
function C(e) {
	let t = Array.from({ length: 4 }, () => new Float64Array(e + 1));
	for (let n = 0; n <= e; n++) {
		let e = n % 2 == 0 ? 1 : -1, r = S(n);
		t[0][n] = e, t[1][n] = 1, t[2][n] = -e * r, t[3][n] = r;
	}
	return t;
}
function w(e, t, n) {
	let r = Array.from({ length: 4 }, () => new Float64Array(e + 1));
	return r[0][0] = 1, r[1][e] = 1, r[2][0] = -t, r[2][1] = t, r[3][e - 1] = -n, r[3][e] = n, r;
}
function T(e, t) {
	let n = Array.from({ length: 4 }, () => new Float64Array(4));
	for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) {
		let a = 0;
		for (let n = 0; n <= t; n++) a += e[r][n] * ((2 * n + 1) / 2) * e[i][n];
		n[r][i] = a;
	}
	return n;
}
function E(e) {
	let t = e.map((e, t) => {
		let n = [...e, ...[
			,
			,
			,
			,
		].fill(0)];
		return n[4 + t] = 1, n;
	});
	for (let e = 0; e < 4; e++) {
		let n = e;
		for (let r = e + 1; r < 4; r++) Math.abs(t[r][e]) > Math.abs(t[n][e]) && (n = r);
		[t[e], t[n]] = [t[n], t[e]];
		let r = t[e][e];
		for (let n = e; n < 8; n++) t[e][n] /= r;
		for (let n = 0; n < 4; n++) {
			if (n === e) continue;
			let r = t[n][e];
			for (let i = e; i < 8; i++) t[n][i] -= r * t[e][i];
		}
	}
	return t.map((e) => e.slice(4));
}
function D(e, t, n) {
	return Array.from({ length: 4 }, (r, i) => {
		let a = new Float64Array(n + 1);
		for (let r = 0; r <= n; r++) for (let n = 0; n < 4; n++) a[r] += e[i][n] * t[n][r];
		return a;
	});
}
function O(e, t, n, r, i = 1) {
	let a = C(e), o = w(e, n, r), s = D(E(T(a, e).map((e) => [...e])), Array.from({ length: 4 }, (n, r) => {
		let i = new Float64Array(e + 1);
		for (let n = 0; n <= e; n++) {
			i[n] = o[r][n];
			for (let o = 0; o <= e; o++) i[n] -= a[r][o] * t[o][n];
		}
		return i;
	}), e);
	return t.map((t, n) => {
		let r = new Float64Array(e + 1), o = (2 * n + 1) / 2;
		for (let c = 0; c <= e; c++) {
			let e = 0;
			for (let t = 0; t < 4; t++) e += a[t][n] * s[t][c];
			r[c] = t[c] + i * o * e;
		}
		return r;
	});
}
function k(e, t, n) {
	if (t === null || n === null) {
		let r = u(e)[0];
		t === null && (t = 1 / r), n === null && (n = 1 / r);
	}
	return [t, n];
}
function A(e, t, n = null, r = null, i = 1) {
	return e < 3 ? b(e, t) : ([n, r] = k(e, n, r), O(e, b(e, t), n, r, i));
}
//#endregion
//#region glk-fractional.ts
function j(e, t) {
	let n = Math.floor(t), r = t - n;
	if (r < 1e-10) return b(e, n);
	let i = b(e, n), a = b(e, n + 1);
	return i.map((t, n) => {
		let i = a[n], o = new Float64Array(e + 1);
		for (let n = 0; n <= e; n++) o[n] = (1 - r) * t[n] + r * i[n];
		return o;
	});
}
//#endregion
//#region glk-closed.ts
function M(e) {
	let t = Math.floor(e / 2);
	return -Math.cos(Math.PI * (t + 1) / e);
}
function N(e, n, r) {
	let i = M(r), a = Math.max(.05, i - .35), o = i + .15;
	function s(n) {
		let r = t(e, -n), i = t(e, n);
		return Math.hypot(r[0] - i[0], r[1] - i[1]);
	}
	let c = i, l = Infinity;
	for (let e = 0; e <= 60; e++) {
		let t = a + (o - a) * e / 60, n = s(t);
		n < l && (l = n, c = t);
	}
	let u = (o - a) / 60, d = Math.max(a, c - u * 1.5), f = Math.min(o, c + u * 1.5), p = .6180339887;
	for (let e = 0; e < 40; e++) {
		let e = f - p * (f - d), t = d + p * (f - d);
		s(e) < s(t) ? f = t : d = e;
	}
	return (d + f) / 2;
}
//#endregion
//#region glk-svg.ts
function P(e) {
	let t = e.length - 1, n = Array.isArray(e[0]), r = [];
	for (let i = 0; i < t; i++) {
		let a = 2 * i + 1;
		if (n) {
			let n = e[0].length, o = Array(n).fill(0);
			for (let r = i + 1; r <= t; r += 2) for (let t = 0; t < n; t++) o[t] += e[r][t];
			r.push(o.map((e) => a * e));
		} else {
			let n = 0;
			for (let r = i + 1; r <= t; r += 2) n += e[r];
			r.push(a * n);
		}
	}
	return r;
}
function ee(e, n = 8, r = -1, i = 1, a = !1) {
	let o = P(e), s = [0, 0], c = (e) => o.length > 0 ? t(o, e) : s, l = (r + i) / 2, u = (i - r) / 2, d = "";
	for (let o = 0; o < n; o++) {
		let s = a ? r + (i - r) * o / n : l - u * Math.cos(Math.PI * o / n), f = a ? r + (i - r) * (o + 1) / n : l - u * Math.cos(Math.PI * (o + 1) / n), p = f - s, m = t(e, s), h = c(s), g = t(e, f), _ = c(f), v = [m[0] + p / 3 * h[0], m[1] + p / 3 * h[1]], y = [g[0] - p / 3 * _[0], g[1] - p / 3 * _[1]], b = (e) => e.toFixed(3);
		o === 0 && (d += `M ${b(m[0])},${b(m[1])}`), d += ` C ${b(v[0])},${b(v[1])} ${b(y[0])},${b(y[1])} ${b(g[0])},${b(g[1])}`;
	}
	return d;
}
function te(e) {
	if (e.length === 0) return [];
	let t = [[0]];
	for (let n = 1; n < e.length; n++) {
		let r = e[n - 1][e[n - 1].length - 1], i = e[n][0];
		r[0] === i[0] && r[1] === i[1] ? t[t.length - 1].push(n) : t.push([n]);
	}
	return t;
}
function F(e, t, n, r, i = null) {
	n % 2 == 0 && n++;
	let a = e.slice(0, e.length - 1);
	if (a.length < 2) return null;
	let o = [];
	for (let e = 0; e < n; e++) for (let e of a) o.push(e);
	o.push(a[0]);
	let s = t(o.length - 1);
	if (!s) return null;
	let c = x(s, o), l = i ?? N(c, a[0], n);
	return ee(c, r, -l, l, !0) + " Z";
}
function ne(e, t, n, r, i = null) {
	return F(e, (e) => b(e, t), n, r, i);
}
function I(t, n = {}) {
	let { width: r, height: i, showGL0: a = !1, showGL1: o = !1, showGL2: s = !1, showM1: c = !1, showFrac: l = !1, showFracMod: d = !1, showPoly: f = !1, kFrac: p = 1, eta: m = null, alpha: h = 1, M: g = 8, styles: _ = {}, closedSet: v = /* @__PURE__ */ new Set(), closedCopies: y = 3, closedOptsMap: S = null, simplify: C = !1 } = n, w = _ ?? {}, { color: T = "#f97", width: E = 2, dash: D = [] } = w.gl0 ?? {}, { color: k = "#7bf", width: M = 2, dash: N = [] } = w.gl1 ?? {}, { color: P = "#8f8", width: I = 2, dash: L = [] } = w.gl2 ?? {}, { color: R = "#fc6", width: z = 2.5, dash: B = [] } = w.modGl1 ?? {}, { color: V = "#fff", width: H = 1.5, dash: U = [8, 3] } = w.frac ?? {}, W = m === null ? "auto" : m.toFixed(2), G = h.toFixed(2), K = p.toFixed(2), q = [];
	function J(e, t) {
		let n = q.find((t) => t.id === e);
		return n || (n = {
			id: e,
			title: t,
			paths: []
		}, q.push(n)), n;
	}
	let Y = t.map((e, t) => ({
		pts: e,
		isClosed: v.has(t),
		copies: S?.get(t)?.copies ?? y,
		seamT: S?.get(t)?.seamT ?? null
	})).filter(({ pts: e }) => e.length >= 2), X = Y.map((e) => e.pts), re = Y.map((e) => e.isClosed), ie = Y.map((e) => e.copies), ae = Y.map((e) => e.seamT), oe = te(X);
	function Z(e, t, n, r, i, a, o, s, c, l, u = null) {
		if (e.length - 1 < n) return;
		let d = ne(e, t, l, r, u);
		if (!d) return;
		let f = c ? ` stroke-dasharray="${c}"` : "";
		J(i, a).paths.push(`    <path d="${d}" stroke="${o}" fill="none" stroke-width="${s}"${f}/>`);
	}
	function se(e) {
		let t = e.length - 1, n = m === null ? u(t)[0] : 0, r = m === null ? 1 / n : m;
		return {
			n: t,
			e1: r,
			e2: r,
			segM: Math.max(g, t)
		};
	}
	function ce(e, t) {
		let n = "";
		for (let r = 0; r < e.length; r++) {
			let i = X[e[r]], a = se(i), o = t(i, a);
			if (!o) return null;
			let s = ee(x(o, i), a.segM);
			n += r === 0 ? s : " " + s.replace(/^M \S+ /, "");
		}
		return n;
	}
	function Q(e, t, n, r, i, a, o = null) {
		let s = ce(e, t);
		if (!s) return;
		let c = o ? ` stroke-dasharray="${o}"` : "";
		J(n, r).paths.push(`    <path d="${s}" stroke="${i}" fill="none" stroke-width="${a}"${c}/>`);
	}
	for (let e of oe) {
		let t = e.length === 1 && re[e[0]];
		if (f) for (let n of e) {
			let e = X[n];
			if (t) {
				let t = e.slice(0, e.length - 1).map(([e, t]) => `${e.toFixed(1)},${t.toFixed(1)}`).join(" ");
				J("polygon", "Control polygon").paths.push(`    <polygon points="${t}" stroke="#555" fill="none" stroke-width="1" stroke-dasharray="4 4"/>`);
			} else {
				let t = e.map(([e, t]) => `${e.toFixed(1)},${t.toFixed(1)}`).join(" ");
				J("polygon", "Control polygon").paths.push(`    <polyline points="${t}" stroke="#555" fill="none" stroke-width="1" stroke-dasharray="4 4"/>`);
			}
		}
		if (t) {
			let t = X[e[0]], n = ie[e[0]], r = ae[e[0]], { segM: i } = se(t), f = (e) => e.length ? e.join(" ") : null;
			if (a && Z(t, 0, 2, i, "gl-0", "GL-0", T, E, f(D), n, r), o && Z(t, 1, 2, i, "gl-1", "GL-1", k, M, f(N), n, r), s && Z(t, 2, 2, i, "gl-2", "GL-2", P, I, f(L), n, r), c) {
				let e = F(t, (e) => {
					let t = m === null ? u(e)[0] : 0, n = m === null ? 1 / t : m;
					return e >= 3 ? A(e, 1, n, n, h) : b(e, 1);
				}, n, i, r);
				if (e) {
					let t = B.length ? ` stroke-dasharray="${B.join(" ")}"` : "";
					J("mod-gl-1", `mod GL-1  η=${W}  α=${G}`).paths.push(`    <path d="${e}" stroke="${R}" fill="none" stroke-width="${z}"${t}/>`);
				}
			}
			if (l) {
				let e = d, a = e ? `GL-k (fractional, mod)  k=${K}  η=${W}  α=${G}` : `GL-k (fractional)  k=${K}`, o = F(t, (t) => {
					let n = j(t, p);
					if (e && t >= 3) {
						let e = m === null ? u(t)[0] : 0, r = m === null ? 1 / e : m;
						return O(t, n, r, r, h);
					}
					return n;
				}, n, i, r);
				if (o) {
					let e = U.length ? ` stroke-dasharray="${U.join(" ")}"` : "";
					J(`frac-k${K}`, a).paths.push(`    <path d="${o}" stroke="${V}" fill="none" stroke-width="${H}"${e}/>`);
				}
			}
		} else if (a && Q(e, (e, { n: t }) => b(t, 0), "gl-0", "GL-0", T, E, D.length ? D.join(" ") : null), o && Q(e, (e, { n: t }) => b(t, 1), "gl-1", "GL-1", k, M, N.length ? N.join(" ") : null), s && Q(e, (e, { n: t }) => t >= 2 ? b(t, 2) : null, "gl-2", "GL-2", P, I, L.length ? L.join(" ") : null), c && Q(e, (e, { n: t, e1: n, e2: r }) => t >= 3 ? A(t, 1, n, r, h) : null, "mod-gl-1", `mod GL-1  η=${W}  α=${G}`, R, z, B.length ? B.join(" ") : null), l) {
			let t = d, n = t ? `GL-k (fractional, mod)  k=${K}  η=${W}  α=${G}` : `GL-k (fractional)  k=${K}`;
			Q(e, (e, { n, e1: r, e2: i }) => {
				let a = j(n, p);
				return t && n >= 3 ? O(n, a, r, i, h) : a;
			}, `frac-k${K}`, n, V, H, U.length ? U.join(" ") : null);
		}
	}
	if (f) {
		let e = [];
		for (let t of X) for (let [n, r] of t) e.push(`    <circle cx="${n.toFixed(1)}" cy="${r.toFixed(1)}" r="4" fill="#666"/>`);
		e.length && J("control-points", "Control points").paths.push(...e);
	}
	let $ = [
		"<svg xmlns=\"http://www.w3.org/2000/svg\"",
		`     width="${r}" height="${i}" viewBox="0 0 ${r} ${i}"`,
		"     style=\"background:#1a1a1a\">"
	];
	for (let { id: e, title: t, paths: n } of q) $.push(`  <g id="${e}">`), $.push(`    <title>${t}</title>`), $.push(...n), $.push("  </g>");
	$.push("</svg>");
	let le = $.join("\n");
	return C ? e(le) : le;
}
//#endregion
//#region glk-render.ts
function L(e) {
	return Array.isArray(e) ? {
		segments: e,
		eta: void 0
	} : {
		segments: e.segments,
		eta: e.eta
	};
}
function R(e, t = {}) {
	let { stroke: n = "#333333", strokeWidth: r = 2, padding: i = 10, background: a } = t, { segments: o, eta: s } = L(e), c = t.eta === void 0 ? s ?? null : t.eta, l = Infinity, u = Infinity, d = -Infinity, f = -Infinity;
	for (let e of o) for (let [t, n] of e) t < l && (l = t), t > d && (d = t), n < u && (u = n), n > f && (f = n);
	if (!isFinite(l)) return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"0\" height=\"0\"></svg>";
	let p = l - i, m = u - i, h = d - l + 2 * i, g = f - u + 2 * i, _ = I(o, {
		width: d + i,
		height: f + i,
		showM1: !0,
		eta: c,
		styles: { modGl1: {
			color: n,
			width: r
		} }
	});
	return _ = _.replace(/width="[^"]*" height="[^"]*" viewBox="[^"]*"/, `width="${h}" height="${g}" viewBox="${p} ${m} ${h} ${g}"`), _ = a ? _.replace(/style="background:[^"]*"/, `style="background:${a}"`) : _.replace(/ style="background:[^"]*"/, ""), _;
}
//#endregion
export { R as render };
