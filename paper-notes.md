# Paper notes — GL-k curves (Ramanantoanina & Hormann, CAGD 127, 2026)

Working notes extracted while reading. Page refs are approximate.

---

## Notation / setup

- n+1 control points  p_0,...,p_n  in R^d
- n Gauss-Legendre (GL) nodes  τ_0 < ... < τ_{n-1}  = roots of P_n on (-1,1)
- ℓ_i  = degree-(n-1) Lagrange polynomial satisfying ℓ_i(τ_j) = δ_{ij}
- t ∈ [-1,1]

---

## Section 2 — GL curves (GL-0)

### Basis functions (p.2)

G_{-1}^n(t) = 1/2
G_n^n(t)   = -1/2
G_i^n(t) + 1/2 = ∫_{-1}^t ℓ_i(s) ds  /  ∫_{-1}^1 ℓ_i(s) ds,   i=0,...,n-1

F_i^n(t) = G_{i-1}^n(t) − G_i^n(t),   i=0,...,n

GL curve:  p(t) = Σ_{i=0}^n  p_i · F_i^n(t)

Endpoint interpolation: p(−1) = p_0, p(1) = p_n  (falls out of the definition)

Tangent at GL node (eq 3):
  p'(τ_i) = v_i / w_i,   v_i = p_{i+1} − p_i,   w_i = ∫_{-1}^1 ℓ_i(s) ds  (= GL quadrature weight)

### Integral of Legendre polynomials (eq 4, p.3)

∫_{-1}^t P_j(s) ds = (P_{j+1}(t) − P_{j-1}(t)) / (2j+1)  +  δ_{j,0}

(Convention: P_{-1} = 0.)

### G_i^n in the Legendre basis (Proposition 2, p.4)

G_i^n(t) + 1/2 = (1/2) · (1 + Σ_{j=0}^{n-2} (P_{j-1}(τ_i) − P_{j+1}(τ_i)) P_j(t)
                               + Σ_{j=n-1}^{n} P_{j-1}(τ_i) P_j(t))

Define coefficients  g_{i,j}  (Legendre coefficients of G_i^n):

  g_{i,j} = (1/2)(P_{j-1}(τ_i) − P_{j+1}(τ_i)),   j = 0,...,n−2
  g_{i,n-1} = (1/2) P_{n-2}(τ_i)
  g_{i,n}   = (1/2) P_{n-1}(τ_i)

for i = 0,...,n−1,  and boundary rows:

  g_{-1,j} = (1/2) δ_{0,j}   →  only g_{-1,0} = 1/2 is nonzero
  g_{n,j}  = −(1/2) δ_{0,j}  →  only g_{n,0}  = −1/2 is nonzero

### Legendre coefficients of the GL curve (eq 9, p.4)

p(t) = Σ_{j=0}^n  c_j P_j(t)

  c_j = Σ_{i=0}^n  (g_{i-1,j} − g_{i,j}) · p_i

This is the basis-change matrix  M_n ∈ R^{(n+1)×(n+1)}  with  M_n[j,i] = g_{i-1,j} − g_{i,j}.

So  c = M_n · p  (matrix–vector product).

---

## Section 3 — Linear-time evaluation (Algorithm 1, p.5)

Legendre 3-term recurrence:

  P_0 = 1,  P_1 = t
  P_j = α_j · t · P_{j-1}  −  β_j · P_{j-2},   j ≥ 2
  α_j = (2j−1)/j,   β_j = (j−1)/j

Algorithm 1  GLEVAL(c_0,...,c_n, t):

  r_2 ← 1         // P_0
  r_1 ← t         // P_1
  p   ← c_0 + r_1 · c_1
  for j = 2,...,n:
    r_j ← α_j · t · r_1 − β_j · r_2
    p   ← p + r_j · c_j
    r_2 ← r_1
    r_1 ← r_j
  return p

Works for scalar or vector c_j.  O(n) after coefficients are known.

---

## Section 4 — GL-k curves (p.5)

### Averaging

Start with  p^0 = (p_0,...,p_n)^T  (n+1 points).

One averaging step  (p^{k-1} has n+k points, p^k has n+k+1 points):

  p^k_0         = p^{k-1}_0
  p^k_i         = (p^{k-1}_{i-1} + p^{k-1}_i) / 2,   i = 1,...,n+k−1
  p^k_{n+k}     = p^{k-1}_{n+k-1}

Matrix form:  p^k = A_k · p^{k-1}

  A_k ∈ R^{(n+k+1)×(n+k)},  A_k = (1/2) · [[2,0,...], [1,1,...], ..., [...,1,1], [...,0,2]]

After k steps:  p has n+k+1 points, curve has degree n+k.

### Reduction operator  R_k  (Definition 1, p.5)

R_k : Π_{n+k} → Π_n

Projects degree-(n+k) polynomial f to the degree-n polynomial g that:
  - minimises ‖f − g‖_{L2}  over [-1,1]
  - subject to  g(−1) = f(−1)  and  g(1) = f(1)  (endpoint constraints)

The GL-k curve is  c^k = R_k[p^k]  (reduce the degree-(n+k) GL curve back to degree n).

### Lemma 1 — Legendre representation of R_k (eq 11, p.5)

Let m = n+k.  If f has Legendre coefficients  f = (f_0,...,f_m)^T,
then  g = R_k[f]  has Legendre coefficients  g = (g_0,...,g_n)^T  given by:

  g_i = f_i  +  Σ_{j=1}^k  s_{ij} · f_{n+j},   i = 0,...,n

where:

  s_{ij} = 0,         if  n+i+j  is odd
  s_{ij} = 1/(n+1),   if  n+i+j  is even and j is odd      ← TODO: double-check these
  s_{ij} = 1/(n+2),   if  n+i+j  is even and j is even     ← TODO: these are hard to read precisely

The matrix form (eq 12):

  R_k  =  [I_{n+1} | S]  ∈ R^{(n+1)×(n+k+1)}

where  S ∈ R^{(n+1)×k}  has entries  s_{ij}.

### Full pipeline for GL-k

  p                           (n+1 control points)
  → p^k = A_k A_{k-1}…A_1 p  (n+k+1 averaged points)
  → Legendre coeffs of GL curve on p^k  via M_{n+k}
  → apply R_k  (Lemma 1)
  → Legendre coeffs c of GL-k curve  (length n+1)
  → evaluate via Algorithm 1

---

---

## Derivation of s_{ij} from first principles (Lemma 1)

The paper image for eq (11) was hard to read precisely, so I re-derived it.

R_k minimises ||f − g||_{L2}  subject to  g(−1)=f(−1), g(1)=f(1).

Using  P_j(±1) = (±1)^j, the endpoint constraints separate into:

  Even Legendre indices:   Σ_{i even, 0≤i≤n}  g_i  =  Σ_{i even, 0≤i≤m}  f_i
  Odd  Legendre indices:   Σ_{i odd,  0≤i≤n}  g_i  =  Σ_{i odd,  0≤i≤m}  f_i

The excess "tail" mass  Σ_{j=n+1}^{m} f_j  (same parity class) must be
distributed among g_0,...,g_n to satisfy the constraint while minimising
  Σ_{i=0}^{n}  2/(2i+1) · (f_i − g_i)^2.

The unconstrained Lagrangian minimum assigns each f_{n+j} to g_i with weight
proportional to the inverse norm  (2i+1).  The normalisation sum (denominator)
splits by parity:

  j odd  →  denominator = Σ_{i : n+i odd,  0≤i≤n} (2i+1) = n(n+1)/2
  j even →  denominator = Σ_{i : n+i even, 0≤i≤n} (2i+1) = (n+1)(n+2)/2

(Both sums evaluate to a triangular number, independent of j's exact value.)

Therefore:

  s_{ij} = 0,                           if n+i+j is odd
  s_{ij} = 2(2i+1) / (n(n+1)),         if n+i+j is even and j is odd
  s_{ij} = 2(2i+1) / ((n+1)(n+2)),     if n+i+j is even and j is even

Equivalently:   s_{ij} = (4i+2) / D_j   where
  D_j = n(n+1)      for j odd
  D_j = (n+1)(n+2)  for j even

Verified for:
  n=1 k=1: s_{0,1}=1  ✓
  n=2 k=1: s_{1,1}=1  ✓
  n=3 k=1: s_{0,1}=1/6, s_{2,1}=5/6  ✓
  n=2 k=2: s_{0,2}=1/6, s_{1,1}=1, s_{2,2}=5/6  ✓
  n=3 k=2: s_{1,2}=3/10, s_{3,2}=7/10  ✓

The paper (eq 11) almost certainly states this as:
  (4i+2) / (n(n+1))    for j odd
  (4i+2) / ((n+1)(n+2)) for j even
but my earlier reading of the image was wrong (I misread the denominator).

---

---

## Page 6 — Fig. 3 (construction overview)

The full GL-k pipeline visualised:

  p^0 = p  →[A_1]→  p^1  →[A_2]→  p^2  →...→  p^k        (averaging, top row)
            ↓F^n            ↓F^{n+1}              ↓F^{n+k}
          GL deg-n       GL deg-n+1            GL deg-n+k    (GL curves, middle row)
            ↓R_0            ↓R_1                  ↓R_k
  c^0=(L_0p)^T P^n   c^1=(L_1p)^T P^n      c^k=(L_kp)^T P^n  (GL-k, third row)
            ↓T_0            ↓T_1                  ↓T_k
  c̃^0=(L̃_0p)^T P^n  c̃^1=(L̃_1p)^T P^n    c̃^k=(L̃_kp)^T P^n  (modified, bottom row)

L_k = R_k M_{n+k} A_k...A_1 ∈ R^{(n+1)×(n+1)}  (can be precomputed)

GL-0 curve c^0 is identical to the GL curve p^0 because R_0 = identity.

Initial c = L_k p costs O(n^2).  Subsequent single-point edit costs O(n).  Eval is O(n).

---

## Page 7 — Proof of Lemma 1 / exact s_{ij} formula

The proof works in the Legendre basis using the L2 weight matrix
  W = diag(w_0,...,w_n),   w_i = 2/(2i+1)

Endpoint constraints written compactly as  C_{n+1} g = C_{m+1} f  where
  C_k = [[1, -1, ..., (-1)^{k-1}],  ∈ R^{2×k}
          [1,  1, ...,  1        ]]

Solve the constrained least-squares problem → stationary point of Lagrangian.

The intermediate matrix V ∈ R^{(n+1)×k} is built from row vectors:
  v_i = (4 / (n(n+1)(n+2))) × { (n+2, 0, n+2, 0, ...) if n+i is odd
                                { (0,   n, 0,   n, ...) if n+i is even

Component-wise:
  v_{i,j} = (4/(n(n+1)(n+2))) × { n+2  if n+i+j even and j odd
                                  { n    if n+i+j even and j even
                                  { 0    if n+i+j odd

Then  S = W^{-1} V, so  s_{i,j} = (2i+1)/2 × v_{i,j}.

This gives (confirmed):
  j odd:  s_{i,j} = 2(2i+1) / (n(n+1))
  j even: s_{i,j} = 2(2i+1) / ((n+1)(n+2))
  odd parity n+i+j: s_{i,j} = 0

---

## Page 8 — Algorithm 2 LEGENDREREDUCE(k, f)

O(n+k) implementation of R_k in the Legendre basis.

Key insight: all s_{i,j} with the same j-parity share the same denominator,
so the tail coefficients f_{n+1},...,f_{n+k} can be summed into just two
accumulators σ_e ("even n+j") and σ_o ("odd n+j") before distributing.

```
LEGENDREREDUCE(k, f):
  m ← length(f) − 1          // degree of f  (= n+k)
  n ← m − k
  σ_e, σ_o ← 0
  for j = 1,...,k:
    if (n + j) is even:  σ_e += f[n+j]
    else:                σ_o += f[n+j]
  if n is even:
    σ_e /= (n+1)(n+2)         // j-even terms → denominator (n+1)(n+2)
    σ_o /= n(n+1)             // j-odd  terms → denominator n(n+1)
  else:
    σ_e /= n(n+1)
    σ_o /= (n+1)(n+2)
  for i = 0,...,n:
    if i is even:  g[i] = f[i] + (4i+2) σ_e
    else:          g[i] = f[i] + (4i+2) σ_o
  return g
```

NOTE on naming: subscript "e/o" refers to parity of n+j, NOT parity of j.
  When n is even: even n+j ↔ even j, so σ_e holds even-j tail, distributed to even-i.
  When n is odd:  even n+j ↔ odd j,  so σ_e holds odd-j  tail, distributed to even-i.
The denominator swap accounts for this.

Verified by hand for: n=1 k=1, n=2 k=1, n=3 k=1, n=2 k=2.

## Page 8 — Section 5: Properties of GL-k curves

- C_i^k(t) = (L_k p)_i are degree-n polynomials, form a basis of Π_n  (Prop 3)
- They form a partition of unity: Σ C_i^k(t) = 1  (Prop 4)
  Proof: A_j maps constant polygon to constant polygon; M_{n+k} of constant = (1,0,...,0)^T.
- NOT a non-negative partition (unlike Bézier) — so no convex-hull property

---

---

## Page 9 — Fig. 4 + properties text

Basis functions C_i^k for n=3,5,10 (rows) and k=0,1,2 (columns) plotted in Fig. 4.

Lower bound C^k = min{C_i^k(t) : i=0,...,n, t∈[-1,1]} < 0  (NOT non-negative!)
  n=3:  C^0≈-0.1162, C^1≈-0.0259, C^2≈-0.0316   (k=1 is the best here)
  n=5:  C^0≈-0.1296, C^1≈-0.0348, C^2≈-0.0239
  n=10: C^0≈-0.1357, C^1≈-0.0363, C^2≈-0.0157

Lower bound → 0 as k→∞ (at least when n ≥ 2k).
Convex combinations are what increase the lower bound (taking convex combo of GL basis of
degree n+k then projecting to degree n amplifies negativity; back-projection counteracts it).

As k increases the curve "shrinks" away from the control polygon (like high-degree Bézier).
GL-k curves are NOT invariant under perspective transforms (only affine), same as Bézier.

---

## Page 9–10 — Section 6: Endpoint tangents / modified GL-k

GL-k curves DO interpolate endpoints p_0 and p_n but do NOT have the endpoint
tangent property (unlike Bézier).  The tangent directions at ±1 are not
necessarily parallel to p_1−p_0 or p_n−p_{n-1}.

### Tangent operator T_k

T_k projects c^k → c̃^k (modified GL-k) minimising ||c̃^k − c^k||_2 subject to:
  1. c̃^k(−1) = c^k(−1) = p_0              (keep endpoint interpolation)
  2. c̃^k(1) = c^k(1) = p_n
  3. (c̃^k)'(−1) ∥ (p_1 − p_0)            (new tangent constraints)
  4. (c̃^k)'(1) ∥ (p_n − p_{n-1})

Uses the identity  P_i'(1) = d_i  and  P_i'(−1) = (−1)^{i+1} d_i
where  d_i = i(i+1)/2  [Olver et al. 2010, Eq. 18.9.15].

Constraints written compactly as  D c̃^k = E p  where:

  D = [[1, −1, ..., (−1)^n      ],   ← endpoint values at t=±1 (rows 1,2)
       [1,  1, ...,  1           ],
       [−d_0, d_1, ..., (−1)^{n+1}d_n],  ← derivative at t=−1 (row 3)
       [ d_0, d_1, ...,  d_n     ]]  ← derivative at t=1  (row 4)

  E = [[first two rows of D · L_k  ← keep endpoint interpolation]
       [−η_1, η_1, 0, ..., 0  ]    ← tangent at t=−1 scales (p_1−p_0)
       [0, ..., 0, −η_2, η_2  ]]   ← tangent at t=1  scales (p_n−p_{n-1})

Solution:  c̃^k = L̃_k p   where
  L̃_k = L_k + W^{-1} D^T (D W^{-1} D^T)^{-1} (E − D L_k)

with  W = diag(2/(2i+1))  as before (L2 weight matrix).

### Default scaling

η_1 = η_2 = 1/ω_0   where  ω_0 = ∫_{-1}^1 ℓ_0(s) ds  (first GL quadrature weight)

This gives  (c̃^k)'(±1) = p'(τ_0)  and  (c̃^k)'(1) = p'(τ_{n-1})  (cf. eq 3).
The user can override η_1, η_2 to change the tangent magnitudes.

---

## Page 10–11 — Section 7: Results

Implementation: C++ with CMake, -O2, Intel i7-10510U, 16 GB RAM.

Complexity:
  - Preprocessing (build L_k or L̃_k):  O(n^2) per curve, grows with k
  - Update after single control-point edit:  O(n)
  - Evaluation at one parameter value:  O(n) via Algorithm 1

Speed observations (1000 random curves, n=3..19, 1000 eval points):
  - GL-k evaluation faster than cubic B-spline for n ≤ 10
  - For n=20, GL-k is less than twice as expensive as cubic B-spline
  - All GL-k (k=0,1,2) have nearly identical runtime (eval is O(n) indep. of k)

Visual observations:
  - GL-1 strongly resembles cubic B-spline with uniform knots
  - Modified GL-1 (with endpoint tangents) is the authors' preferred curve type
  - GL-k with k>0 "shrinks" away from control polygon (high-k effect)
  - Zig-zag control polygons: GL-k (k>0) fails to capture shape; GL-0 handles better
  - Curvature of modified GL-1 is smoother / fewer inflections than cubic B-spline

Fig. 8: Line-art examples with modified GL-1 curves.
  - Face: single curve of degree 75!
  - Butterfly, lady: several GL-1 curves joined C^0 or C^1

---

## Page 11 — Section 8: Conclusion

- GL-k curves: novel polynomial curves, affine-invariant, endpoint interpolation
- NOT convex-hull property (basis not non-negative)
- Favourite: modified GL-1 (endpoint tangents)
- C^0 / C^1 continuity at joints is straightforward (endpoint interp + tangent prop)

---

## TODO / uncertainties

- s_{ij} formula: RESOLVED — see derivation section above.
  Confirmed formula: 2(2i+1)/(n(n+1)) for j odd, 2(2i+1)/((n+1)(n+2)) for j even.

- Modified GL-k tangent operator T_k: the D/E matrices are written out above but
  the η_1, η_2 default choice needs careful implementation.  The matrix inversion
  (D W^{-1} D^T) is 4×4 so manageable.

- GL weights formula: standard w_i = 2/((1−τ_i^2)(P_n'(τ_i))^2) not needed explicitly
  since W = diag(2/(2i+1)) in the LEGENDREREDUCE algorithm.

## Modules written so far

- legendre.mjs     — P_n(t) + derivative, glNodes(n) via Newton
- gleval.mjs       — Algorithm 1 GLEVAL: linear-time Legendre series eval
- gl-averaging.mjs — averageStep / applyAveraging: k midpoint-averaging steps
- gl0-legendre.mjs — buildGL0Matrix / gl0LegendreCoeffs: control pts → Legendre coeffs

## Next to write

- legendrereduce.mjs  — Algorithm 2 LEGENDREREDUCE (O(n+k) R_k operator)
- glk-curve.mjs       — top-level: control pts + k → Legendre coeffs of GL-k curve
                        (wires together averaging + gl0-legendre + legendrereduce)
- demo.html / demo.mjs — Canvas visualisation to sanity-check against paper figures
