#!/usr/bin/env node

// cli/main.ts
import readline from "node:readline";

// src/core/groups.ts
function cyclic(n) {
  const t2 = new Int8Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) t2[a * n + b] = (a + b) % n;
  return t2;
}
function product(A, B) {
  const p = Math.round(Math.sqrt(A.length)), q = Math.round(Math.sqrt(B.length)), n = p * q;
  const t2 = new Int8Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const a1 = Math.floor(a / q), a2 = a % q, b1 = Math.floor(b / q), b2 = b % q;
    t2[a * n + b] = A[a1 * p + b1] * q + B[a2 * q + b2];
  }
  return t2;
}
function dihedral(m) {
  const n = 2 * m, t2 = new Int8Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const i1 = a % m, j1 = Math.floor(a / m), i2 = b % m, j2 = Math.floor(b / m);
    const i = (i1 + (j1 ? m - i2 : i2)) % m;
    t2[a * n + b] = i + m * (j1 ^ j2);
  }
  return t2;
}
function dicyclic(m) {
  const k = 2 * m, n = 2 * k, t2 = new Int8Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const i1 = a % k, j1 = Math.floor(a / k), i2 = b % k, j2 = Math.floor(b / k);
    let i = i1 + (j1 ? k - i2 : i2), j = j1 + j2;
    if (j === 2) {
      i += m;
      j = 0;
    }
    t2[a * n + b] = i % k + k * j;
  }
  return t2;
}
function fromPermutations(gens) {
  const key = (p) => p.join(",");
  const mul = (p, q) => q.map((x) => p[x]);
  const id = gens[0].map((_, i) => i);
  const els = [id], index = /* @__PURE__ */ new Map([[key(id), 0]]);
  for (let i = 0; i < els.length; i++) for (const g of gens) {
    const x = mul(els[i], g);
    if (!index.has(key(x))) {
      index.set(key(x), els.length);
      els.push(x);
    }
  }
  const n = els.length, t2 = new Int8Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) t2[a * n + b] = index.get(key(mul(els[a], els[b])));
  return t2;
}
var C = cyclic;
var sub = (k) => String(k).split("").map((d) => "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089"[+d]).join("");
function entry(id, name, table) {
  const n = Math.round(Math.sqrt(table.length));
  let abelian = true;
  for (let a = 0; a < n && abelian; a++) for (let b = 0; b < a; b++) if (table[a * n + b] !== table[b * n + a]) {
    abelian = false;
    break;
  }
  return { id, name, order: n, table, abelian };
}
var GROUPS = [
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => entry(`C${n}`, `C${sub(n)}`, C(n))),
  entry("V4", "C\u2082\xD7C\u2082", product(C(2), C(2))),
  entry("S3", "S\u2083", dihedral(3)),
  entry("C4xC2", "C\u2084\xD7C\u2082", product(C(4), C(2))),
  entry("C2xC2xC2", "C\u2082\xD7C\u2082\xD7C\u2082", product(product(C(2), C(2)), C(2))),
  entry("D4", "D\u2084", dihedral(4)),
  entry("Q8", "Q\u2088", dicyclic(2)),
  entry("C3xC3", "C\u2083\xD7C\u2083", product(C(3), C(3))),
  entry("D5", "D\u2085", dihedral(5)),
  entry("C6xC2", "C\u2086\xD7C\u2082", product(C(6), C(2))),
  entry("D6", "D\u2086", dihedral(6)),
  entry("A4", "A\u2084", fromPermutations([[1, 2, 0, 3], [1, 0, 3, 2]])),
  entry("Dic3", "Dic\u2083", dicyclic(3))
].sort((a, b) => a.order - b.order);
var ORDERS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var groupsOfOrder = (n) => GROUPS.filter((g) => g.order === n);
var groupById = (id) => GROUPS.find((g) => g.id === id);
var LABELS = "0123456789ABCDEFGHJK";
function isGroupTable(t2, n) {
  for (let a = 0; a < n; a++) {
    let rows = 0, cols = 0;
    for (let b = 0; b < n; b++) {
      const x = t2[a * n + b], y = t2[b * n + a];
      if (x < 0 || x >= n || y < 0 || y >= n) return false;
      rows |= 1 << x;
      cols |= 1 << y;
    }
    if (rows !== (1 << n) - 1 || cols !== (1 << n) - 1) return false;
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const ab = t2[a * n + b];
    for (let c = 0; c < n; c++) if (t2[ab * n + c] !== t2[a * n + t2[b * n + c]]) return false;
  }
  return true;
}
function relabel(t2, n, p) {
  const out = new Int8Array(n * n).fill(-1);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const v = t2[a * n + b];
    out[p[a] * n + p[b]] = v < 0 ? -1 : p[v];
  }
  return out;
}

// src/core/solve.ts
var divCache = /* @__PURE__ */ new Map();
function divisions(g) {
  let d = divCache.get(g.id);
  if (!d) {
    const n = g.order, M = g.table, L2 = new Int8Array(n * n), R = new Int8Array(n * n);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const c = M[a * n + b];
      L2[a * n + c] = b;
      R[b * n + c] = a;
    }
    divCache.set(g.id, d = { L: L2, R });
  }
  return d;
}
function numberings(g, clues, order, visit) {
  const n = g.order, M = g.table, { L: L2, R } = divisions(g);
  const phi = new Int8Array(n).fill(-1), used = new Uint8Array(n);
  const trail = [];
  const set = (label2, el) => {
    if (used[el]) return false;
    phi[label2] = el;
    used[el] = 1;
    trail.push(label2);
    return true;
  };
  const propagate = () => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const [i, j, k] of clues) {
        const a = phi[i], b = phi[j], c = phi[k];
        if (a >= 0 && b >= 0) {
          const t2 = M[a * n + b];
          if (c >= 0) {
            if (c !== t2) return false;
          } else {
            if (!set(k, t2)) return false;
            changed = true;
          }
        } else if (a >= 0 && c >= 0) {
          if (!set(j, L2[a * n + c])) return false;
          changed = true;
        } else if (b >= 0 && c >= 0) {
          if (!set(i, R[b * n + c])) return false;
          changed = true;
        }
      }
    }
    return true;
  };
  const rec = () => {
    const label2 = order.find((x) => phi[x] < 0);
    if (label2 === void 0) return visit(phi);
    for (let el = 0; el < n; el++) {
      if (used[el]) continue;
      const mark = trail.length;
      set(label2, el);
      if (propagate() && rec()) return true;
      while (trail.length > mark) {
        const x = trail.pop();
        used[phi[x]] = 0;
        phi[x] = -1;
      }
    }
    return false;
  };
  return rec();
}
function tables(n, clues, limit = 2) {
  const weight = new Array(n).fill(0);
  for (const c of clues) for (const x of c) weight[x]++;
  const order = [...Array(n).keys()].sort((a, b) => weight[b] - weight[a]);
  const seen = /* @__PURE__ */ new Map();
  for (const g of GROUPS) {
    if (g.order !== n) continue;
    const M = g.table;
    const stop = numberings(g, clues, order, (phi) => {
      const inv = new Int8Array(n);
      for (let i = 0; i < n; i++) inv[phi[i]] = i;
      const t2 = new Int8Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t2[i * n + j] = inv[M[phi[i] * n + phi[j]]];
      const key = t2.join(",");
      if (!seen.has(key)) seen.set(key, { table: t2, group: g });
      return seen.size >= limit;
    });
    if (stop) break;
  }
  return [...seen.values()];
}
var isUnique = (n, clues) => tables(n, clues, 2).length === 1;
function cluesOf(t2, n) {
  const out = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t2[a * n + b] >= 0) out.push([a, b, t2[a * n + b]]);
  return out;
}
function identify(t2, n) {
  return tables(n, cluesOf(t2, n), 1)[0]?.group;
}
var Contradiction = class extends Error {
};
var BAD = new Contradiction();
var PRIME_OR_SQUARE = /* @__PURE__ */ new Set([2, 3, 4, 5, 7, 9, 11, 13, 17, 19, 23, 25, 29, 31]);
var Grid = class _Grid {
  n;
  val;
  cand;
  filled = 0;
  /** how many candidates had to be ruled out by supposing them */
  supposes = 0;
  /** also use what any student of groups knows without working it out cell by cell (see theory()) */
  theorems = false;
  constructor(n, clues = []) {
    this.n = n;
    this.val = new Int8Array(n * n).fill(-1);
    this.cand = new Int32Array(n * n).fill((1 << n) - 1);
    for (const [r, c, v] of clues) this.put(r, c, v);
  }
  copy() {
    const g = Object.create(_Grid.prototype);
    g.n = this.n;
    g.val = this.val.slice();
    g.cand = this.cand.slice();
    g.filled = this.filled;
    g.supposes = 0;
    g.theorems = this.theorems;
    return g;
  }
  put(r, c, v) {
    const n = this.n, at = r * n + c;
    if (this.val[at] >= 0) {
      if (this.val[at] !== v) throw BAD;
      return false;
    }
    const bit = 1 << v;
    if (!(this.cand[at] & bit)) throw BAD;
    this.val[at] = v;
    this.cand[at] = bit;
    this.filled++;
    for (let x = 0; x < n; x++) {
      if (x !== c && !(this.cand[r * n + x] &= ~bit)) throw BAD;
      if (x !== r && !(this.cand[x * n + c] &= ~bit)) throw BAD;
    }
    return true;
  }
  latin() {
    const n = this.n, val = this.val, cand = this.cand;
    let changed = false;
    for (let at = 0; at < n * n; at++) {
      const m = cand[at];
      if (val[at] < 0 && (m & m - 1) === 0) {
        this.put(at / n | 0, at % n, 31 - Math.clz32(m));
        changed = true;
      }
    }
    for (let v = 0; v < n; v++) {
      const bit = 1 << v;
      for (let r = 0; r < n; r++) {
        let count = 0, where = -1;
        for (let c = 0; c < n; c++) if (cand[r * n + c] & bit) {
          count++;
          where = c;
        }
        if (!count) throw BAD;
        if (count === 1 && val[r * n + where] < 0) {
          this.put(r, where, v);
          changed = true;
        }
      }
      for (let c = 0; c < n; c++) {
        let count = 0, where = -1;
        for (let r = 0; r < n; r++) if (cand[r * n + c] & bit) {
          count++;
          where = r;
        }
        if (!count) throw BAD;
        if (count === 1 && val[where * n + c] < 0) {
          this.put(where, c, v);
          changed = true;
        }
      }
    }
    return changed;
  }
  /** (a·b)·c and a·(b·c) are the same cell value */
  assoc() {
    const n = this.n, val = this.val, cand = this.cand;
    let changed = false;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x = val[a * n + b];
      if (x < 0) continue;
      for (let c = 0; c < n; c++) {
        const y = val[b * n + c];
        if (y < 0) continue;
        const pa = x * n + c, qa = a * n + y, p = val[pa], q = val[qa];
        if (p >= 0 && q >= 0) {
          if (p !== q) throw BAD;
        } else if (p >= 0) {
          if (this.put(a, y, p)) changed = true;
        } else if (q >= 0) {
          if (this.put(x, c, q)) changed = true;
        } else {
          const m = cand[pa] & cand[qa];
          if (!m) throw BAD;
          if (m !== cand[pa] || m !== cand[qa]) {
            cand[pa] = m;
            cand[qa] = m;
            changed = true;
          }
        }
      }
    }
    return changed;
  }
  /**
   * Shortcuts. Each of these follows from the two rules, but a player who knows it does not have to derive it,
   * so a puzzle that falls to them is easier than cell-by-cell reasoning says. They are all true of every group.
   *   - an element that fixes anything is the identity, and the identity fixes everything; nothing else fixes anything
   *   - if x·y is the identity then so is y·x
   *   - the order of an element divides the order of the group (Lagrange)
   *   - a group of prime order, or of order p², or with an element of full order, is commutative
   */
  theory() {
    const n = this.n, val = this.val, cand = this.cand;
    let changed = false;
    const limit = (at, mask) => {
      const m = cand[at] & mask;
      if (!m) throw BAD;
      if (m !== cand[at]) {
        cand[at] = m;
        changed = true;
      }
    };
    let e = -1;
    for (let a = 0; a < n && e < 0; a++) for (let b = 0; b < n; b++) if (val[a * n + b] === b || val[b * n + a] === b) {
      e = a;
      break;
    }
    let commutative = PRIME_OR_SQUARE.has(n);
    if (e >= 0) {
      for (let x = 0; x < n; x++) {
        if (this.put(e, x, x)) changed = true;
        if (this.put(x, e, x)) changed = true;
      }
      for (let a = 0; a < n; a++) {
        if (a === e) continue;
        for (let b = 0; b < n; b++) {
          if (val[a * n + b] < 0) limit(a * n + b, ~(1 << b));
          if (val[b * n + a] < 0) limit(b * n + a, ~(1 << b));
        }
      }
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (val[x * n + y] === e && this.put(y, x, e)) changed = true;
      for (let x = 0; x < n; x++) {
        if (x === e) continue;
        for (let k = 1, p = x; k < n; k++) {
          const next = p * n + x;
          if (n % (k + 1) !== 0 && val[next] < 0) limit(next, ~(1 << e));
          p = val[next];
          if (p < 0 || p === e) break;
          if (2 * (k + 1) >= n) commutative = true;
        }
      }
    }
    if (commutative) for (let a = 0; a < n; a++) for (let b = 0; b < a; b++) {
      const p = a * n + b, q = b * n + a;
      if (val[p] >= 0) {
        if (this.put(b, a, val[p])) changed = true;
      } else if (val[q] >= 0) {
        if (this.put(a, b, val[q])) changed = true;
      } else {
        const m = cand[p] & cand[q];
        limit(p, m);
        limit(q, m);
      }
    }
    return changed;
  }
  suppose(maxSupposes) {
    const n = this.n;
    let changed = false;
    for (let at = 0; at < n * n; at++) {
      if (this.val[at] >= 0) continue;
      for (let v = 0; v < n; v++) {
        if (!(this.cand[at] >> v & 1)) continue;
        const g = this.copy();
        try {
          g.put(at / n | 0, at % n, v);
          g.run(2);
        } catch (e) {
          if (e !== BAD) throw e;
          if (!(this.cand[at] &= ~(1 << v))) throw BAD;
          changed = true;
          if (++this.supposes > maxSupposes) return false;
        }
      }
      if (changed) return true;
    }
    return changed;
  }
  /** reason at the given level until nothing more follows; throws Contradiction if the cells are inconsistent */
  run(level, maxSupposes = Infinity) {
    for (; ; ) {
      let changed = this.latin();
      if (level >= 2 && this.assoc()) changed = true;
      if (changed) continue;
      if (level >= 2 && this.theorems && this.theory()) continue;
      if (level >= 3 && this.filled < this.n * this.n && this.supposes <= maxSupposes && this.suppose(maxSupposes)) continue;
      return;
    }
  }
  get solved() {
    return this.filled === this.n * this.n;
  }
};
function solvesAt(n, clues, level, maxSupposes = Infinity, theorems = false) {
  const g = new Grid(n, clues);
  g.theorems = theorems;
  try {
    g.run(level, maxSupposes);
  } catch (e) {
    if (e !== BAD) throw e;
    return { solved: false, supposes: g.supposes };
  }
  return { solved: g.solved, supposes: g.supposes };
}
function rate(n, clues, theorems = false) {
  for (const level of [1, 2, 3]) {
    const r = solvesAt(n, clues, level, Infinity, theorems);
    if (r.solved) return { level, supposes: r.supposes };
  }
  return { level: 4, supposes: 0 };
}
function hint(n, cells, solution) {
  const at = (r, c) => cells[r * n + c];
  const cand = new Int32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (at(r, c) >= 0) continue;
    let m = (1 << n) - 1;
    for (let x = 0; x < n; x++) {
      if (at(r, x) >= 0) m &= ~(1 << at(r, x));
      if (at(x, c) >= 0) m &= ~(1 << at(x, c));
    }
    cand[r * n + c] = m;
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = at(a, b);
    if (x < 0) continue;
    for (let c = 0; c < n; c++) {
      const y = at(b, c);
      if (y < 0) continue;
      const p = at(x, c), q = at(a, y);
      if (p >= 0 && q < 0) return { kind: "assoc", r: a, c: y, v: p, a, b, c3: c, x, y };
      if (q >= 0 && p < 0) return { kind: "assoc", r: x, c, v: q, a, b, c3: c, x, y };
    }
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const m = cand[r * n + c];
    if (at(r, c) < 0 && m && (m & m - 1) === 0) return { kind: "cell", r, c, v: 31 - Math.clz32(m) };
  }
  for (let v = 0; v < n; v++) for (let r = 0; r < n; r++) {
    let count = 0, where = -1, placed = false;
    for (let c = 0; c < n; c++) {
      if (at(r, c) === v) placed = true;
      else if (cand[r * n + c] >> v & 1) {
        count++;
        where = c;
      }
    }
    if (!placed && count === 1) return { kind: "row", r, c: where, v };
    count = 0;
    where = -1;
    placed = false;
    for (let c = 0; c < n; c++) {
      if (at(c, r) === v) placed = true;
      else if (cand[c * n + r] >> v & 1) {
        count++;
        where = c;
      }
    }
    if (!placed && count === 1) return { kind: "col", r: where, c: r, v };
  }
  const clues = cluesOf(cells, n);
  const g = new Grid(n, clues);
  try {
    g.run(2);
  } catch {
    return void 0;
  }
  for (let i = 0; i < n * n; i++) if (cells[i] < 0 && g.val[i] >= 0) return { kind: "chain", r: i / n | 0, c: i % n, v: g.val[i] };
  let best = -1, bestCount = 99;
  for (let i = 0; i < n * n; i++) {
    if (cells[i] >= 0) continue;
    let k = 0;
    for (let m = g.cand[i]; m; m &= m - 1) k++;
    if (k < bestCount) {
      bestCount = k;
      best = i;
    }
  }
  if (best < 0) return void 0;
  const wrong = [];
  for (let v = 0; v < n; v++) if (g.cand[best] >> v & 1 && v !== solution[best]) wrong.push(v);
  return { kind: "suppose", r: best / n | 0, c: best % n, v: solution[best], wrong };
}
function conflicts(n, cells) {
  const out = [];
  for (let r = 0; r < n; r++) for (let c1 = 0; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) {
    if (cells[r * n + c1] >= 0 && cells[r * n + c1] === cells[r * n + c2]) out.push({ kind: "row", cells: [r * n + c1, r * n + c2] });
    if (cells[c1 * n + r] >= 0 && cells[c1 * n + r] === cells[c2 * n + r]) out.push({ kind: "col", cells: [c1 * n + r, c2 * n + r] });
  }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = cells[a * n + b];
    if (x < 0) continue;
    for (let c = 0; c < n; c++) {
      const y = cells[b * n + c];
      if (y < 0) continue;
      const p = cells[x * n + c], q = cells[a * n + y];
      if (p >= 0 && q >= 0 && p !== q) out.push({ kind: "assoc", cells: [a * n + b, b * n + c, x * n + c, a * n + y], a, b, c });
    }
  }
  return out;
}
function forced(n, cells) {
  const g = new Grid(n);
  try {
    for (const [r, c, v] of cluesOf(cells, n)) g.put(r, c, v);
    g.run(2);
  } catch {
    return void 0;
  }
  return g.val;
}

// src/core/generate.ts
var DIFFICULTIES = ["easy", "normal", "expert"];
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t2 = a;
    t2 = Math.imul(t2 ^ t2 >>> 15, t2 | 1);
    t2 ^= t2 + Math.imul(t2 ^ t2 >>> 7, t2 | 61);
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(xs, rng) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
var normalBudget = (n) => Math.max(2, Math.floor(n / 2));
function meets(n, difficulty, givens) {
  if (difficulty === "easy") return solvesAt(n, givens, 2).solved;
  if (solvesAt(n, givens, 2, Infinity, true).solved) return false;
  const few = solvesAt(n, givens, 3, normalBudget(n), true).solved;
  return difficulty === "normal" ? few : !few && isUnique(n, givens);
}
function strip(clues, ok, rng) {
  clues = shuffle(clues.slice(), rng);
  for (let k = 0; k < clues.length; ) {
    const trial = clues.slice(0, k).concat(clues.slice(k + 1));
    if (ok(trial)) clues = trial;
    else k++;
  }
  return clues;
}
function build(n, difficulty, rng, g) {
  const p = shuffle([...Array(n).keys()], rng);
  let solution = relabel(g.table, n, p);
  if (rng() < 0.5) {
    const t2 = new Int8Array(n * n);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) t2[b * n + a] = solution[a * n + b];
    solution = t2;
  }
  let givens = strip(cluesOf(solution, n), (c) => solvesAt(n, c, 2).solved, rng);
  if (difficulty === "normal") givens = strip(givens, (c) => solvesAt(n, c, 3, normalBudget(n), true).solved, rng);
  if (difficulty === "expert") givens = strip(givens, (c) => isUnique(n, c), rng);
  givens.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { n, difficulty, groupId: g.id, givens, solution };
}
var tries = (n) => n <= 7 ? 400 : 40;
var offered = (n, difficulty) => difficulty === "easy" || n >= (difficulty === "normal" ? 3 : 4);
function generateFor(g, difficulty, rng) {
  for (let attempt = 0, most = tries(g.order); attempt < most; attempt++) {
    const p = build(g.order, difficulty, rng, g);
    if (meets(g.order, difficulty, p.givens)) return p;
  }
  return void 0;
}
function generate(n, difficulty, rng) {
  if (!offered(n, difficulty)) return void 0;
  const order = shuffle(groupsOfOrder(n).slice(), rng);
  for (const g of order) {
    const p = generateFor(g, difficulty, rng);
    if (p) return p;
  }
  return void 0;
}

// src/core/structure.ts
function identityOf(n, t2) {
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t2[a * n + b] === b || t2[b * n + a] === b) return a;
  return void 0;
}
function elementFacts(n, t2, x) {
  const e = identityOf(n, t2);
  let order, inverse;
  if (e !== void 0) {
    if (x === e) order = 1;
    else for (let k = 2, p = x; k <= n; k++) {
      p = t2[p * n + x];
      if (p < 0) break;
      if (p === e) {
        order = k;
        break;
      }
    }
    for (let y = 0; y < n; y++) if (t2[x * n + y] === e || t2[y * n + x] === e) inverse = y;
  }
  const commutesWith = [], conj = /* @__PURE__ */ new Set([x]);
  for (let y = 0; y < n; y++) {
    if (y === x || t2[x * n + y] >= 0 && t2[x * n + y] === t2[y * n + x]) commutesWith.push(y);
    if (e === void 0) continue;
    let yInv = -1;
    for (let z = 0; z < n; z++) if (t2[y * n + z] === e || t2[z * n + y] === e) yInv = z;
    if (yInv < 0) continue;
    const yx = t2[y * n + x];
    if (yx >= 0 && t2[yx * n + yInv] >= 0) conj.add(t2[yx * n + yInv]);
  }
  return { identity: e, order, inverse, commutesWith, conjugates: [...conj].sort((a, b) => a - b) };
}
function leadingNormalSubgroups(n, t2) {
  const out = [];
  const e = identityOf(n, t2);
  if (e === void 0) return out;
  const inv = new Int8Array(n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (t2[a * n + b] === e) inv[a] = b;
  for (let k = 2; k < n; k++) {
    if (n % k) continue;
    let ok = true;
    for (let a = 0; a < k && ok; a++) for (let b = 0; b < k; b++) if (t2[a * n + b] >= k) {
      ok = false;
      break;
    }
    for (let g = 0; g < n && ok; g++) for (let h = 0; h < k; h++) if (t2[t2[g * n + h] * n + inv[g]] >= k) {
      ok = false;
      break;
    }
    if (!ok) continue;
    const sub2 = new Int8Array(k * k);
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) sub2[a * k + b] = t2[a * n + b];
    const cosetOf = new Int8Array(n).fill(-1);
    let m = 0;
    for (let g = 0; g < n; g++) {
      if (cosetOf[g] >= 0) continue;
      for (let h = 0; h < k; h++) cosetOf[t2[g * n + h]] = m;
      m++;
    }
    const q = new Int8Array(m * m);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) q[cosetOf[a] * m + cosetOf[b]] = cosetOf[t2[a * n + b]];
    out.push({ size: k, group: identify(sub2, k), quotient: identify(q, m) });
  }
  return out;
}

// src/game/session.ts
var LETTER = { easy: "e", normal: "n", expert: "x" };
var puzzleCode = (n, difficulty, seed) => `${n}-${LETTER[difficulty]}-${(seed >>> 0).toString(36)}`;
function parseCode(code) {
  const m = /^(\d+)-([a-z])-([0-9a-z]+)$/.exec(code.trim().toLowerCase());
  if (!m) return void 0;
  const n = +m[1], difficulty = DIFFICULTIES.find((d) => LETTER[d] === m[2]), seed = parseInt(m[3], 36);
  if (!difficulty || !groupsOfOrder(n).length || !Number.isFinite(seed)) return void 0;
  return { n, difficulty, seed: seed >>> 0 };
}
var randomSeed = () => (Date.now() ^ Math.random() * 2 ** 31) >>> 0;
function newPuzzle(n, difficulty, seed = randomSeed()) {
  const p = generate(n, difficulty, mulberry32(seed));
  if (!p) return void 0;
  const cells = new Int8Array(n * n).fill(-1), given = new Uint8Array(n * n);
  for (const [r, c, v] of p.givens) {
    cells[r * n + c] = v;
    given[r * n + c] = 1;
  }
  return { mode: "puzzle", n, difficulty, code: puzzleCode(n, difficulty, seed), cells, given, solution: p.solution, perm: [...Array(n).keys()], history: [], hints: 0, solved: void 0 };
}
function newBuild(n) {
  return { mode: "build", n, difficulty: "easy", code: void 0, cells: new Int8Array(n * n).fill(-1), given: new Uint8Array(n * n), solution: void 0, perm: [...Array(n).keys()], history: [], hints: 0, solved: void 0 };
}
function remember(s) {
  s.history.push({ cells: s.cells.slice(), given: s.given.slice(), solution: s.solution?.slice(), perm: s.perm.slice() });
  if (s.history.length > 400) s.history.shift();
}
function inspect(s, before) {
  const broken = conflicts(s.n, s.cells), full = !s.cells.includes(-1);
  let won;
  if (full && !broken.length && !s.solved && isGroupTable(s.cells, s.n)) won = s.solved = identify(s.cells, s.n);
  const changed = [];
  if (before) s.cells.forEach((x, i) => {
    if (x >= 0 && x !== before[i]) changed.push(i);
  });
  return { changed, conflicts: broken, full, won };
}
function place(s, at, v, opts = {}) {
  if (s.solved || at < 0 || at >= s.n * s.n || v < -1 || v >= s.n || s.given[at] || s.cells[at] === v) return void 0;
  remember(s);
  const before = s.cells.slice();
  s.cells[at] = v;
  let report = inspect(s, before);
  if (!report.conflicts.length && v >= 0 && opts.autofill && !s.solved) {
    const f = forced(s.n, s.cells);
    if (f) {
      s.cells.set(f);
      report = inspect(s, before);
    }
  }
  return report;
}
function swapElements(s, a, b) {
  remember(s);
  const n = s.n, p = [...Array(n).keys()];
  p[a] = b;
  p[b] = a;
  s.cells = relabel(s.cells, n, p);
  if (s.solution) s.solution = relabel(s.solution, n, p);
  const given = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) given[p[r] * n + p[c]] = s.given[r * n + c];
  s.given = given;
  s.perm = s.perm.map((x) => p[x]);
}
function undo(s) {
  if (s.solved) return void 0;
  const last = s.history.pop();
  if (!last) return void 0;
  s.cells = last.cells;
  s.given = last.given;
  s.solution = last.solution;
  s.perm = last.perm;
  return inspect(s);
}
function restart(s) {
  if (!s.history.length) return false;
  const first = s.history[0];
  s.cells = first.cells;
  s.given = first.given;
  s.solution = first.solution;
  s.perm = first.perm;
  s.history = [];
  s.solved = void 0;
  return true;
}
function advise(s) {
  if (s.solved || !s.solution) return void 0;
  const wrong = s.cells.findIndex((v, i) => v >= 0 && v !== s.solution[i]);
  if (wrong >= 0) return { kind: "mistake", at: wrong };
  const h = hint(s.n, s.cells, s.solution);
  if (!h) return void 0;
  s.hints++;
  return { kind: "step", hint: h };
}
function toJSON(s) {
  const snap = (h) => ({ cells: [...h.cells], given: [...h.given], perm: h.perm });
  return { mode: s.mode, n: s.n, difficulty: s.difficulty, code: s.code, ...snap(s), hints: s.hints, solved: s.solved?.id, history: s.history.map(snap) };
}
function fromJSON(j) {
  const named = j.code ? parseCode(j.code) : void 0;
  const original = named ? generate(named.n, named.difficulty, mulberry32(named.seed))?.solution : void 0;
  const snap = (h) => ({ cells: Int8Array.from(h.cells), given: Uint8Array.from(h.given), perm: h.perm, solution: original && relabel(original, j.n, h.perm) });
  return {
    mode: j.mode,
    n: j.n,
    difficulty: j.difficulty,
    code: j.code,
    ...snap(j),
    hints: j.hints ?? 0,
    solved: j.solved ? groupsOfOrder(j.n).find((g) => g.id === j.solved) : void 0,
    history: (j.history ?? []).map(snap)
  };
}

// src/game/progress.ts
var emptyProgress = () => ({ found: [], solved: {} });
function recordArrangement(p, s) {
  const fresh = [];
  if (!s.solved) return fresh;
  for (const step of leadingNormalSubgroups(s.n, s.cells)) {
    if (step.group && !p.found.includes(step.group.id)) {
      p.found.push(step.group.id);
      fresh.push(step.group);
    }
  }
  return fresh;
}
function recordSolve(p, s, group) {
  const isNew = !p.found.includes(group.id);
  if (isNew) p.found.push(group.id);
  if (s.mode === "puzzle") {
    const k = `${s.n}:${s.difficulty}`;
    p.solved[k] = (p.solved[k] ?? 0) + 1;
  }
  return { isNew, newSubgroups: recordArrangement(p, s) };
}

// src/i18n.ts
var en = {
  tagline: "Fill in a multiplication table. Find out which group you made.",
  puzzles: "Puzzles",
  build: "Build",
  collection: "Collection",
  easy: "Easy",
  normal: "Normal",
  expert: "Expert",
  easyNote: "Every cell follows from the two rules.",
  normalNote: "Sometimes you must suppose a value and see it fail.",
  expertNote: "No given can be removed. Few cells, one table.",
  order: "order",
  solved: "solved",
  groupsFound: "found",
  pickOrder: "How many elements?",
  buildIntro: "An empty table. Fill it so that it is a group, any group, and see which one it is.",
  rules: "The rules",
  rule1: "Each element appears once in every row and every column.",
  rule2: "(a\xB7b)\xB7c = a\xB7(b\xB7c), for every a, b, c.",
  rulesMore: "That is the whole definition of a group. The cell in row a, column b is a\xB7b.",
  hint: "Hint",
  undo: "Undo",
  restart: "Restart",
  next: "New puzzle",
  back: "Back",
  erase: "Erase",
  autofill: "Fill what follows",
  autofillNote: "cells forced by the rules fill themselves",
  element: "Element",
  elOrder: "order",
  elInverse: "inverse",
  elCommutes: "commutes with",
  elConj: "conjugates",
  elIdentity: "the identity",
  unknown: "?",
  pickCell: "Pick a cell, then a value. Click two headers to swap two elements.",
  swapHint: "Now click another header to swap the two elements.",
  hintCell: "Row {r} and column {c} already contain every value except {v}.",
  hintRow: "In row {r}, the value {v} can only go in column {c}.",
  hintCol: "In column {c}, the value {v} can only go in row {r}.",
  hintAssoc: "({a}\xB7{b})\xB7{c} = {a}\xB7({b}\xB7{c}). Here {a}\xB7{b} = {x} and {b}\xB7{c} = {y}, so {x}\xB7{c} and {a}\xB7{y} are the same. One of them is {v}; so is the other.",
  hintChain: "The two rules, applied a few times over, leave only {v} for row {r}, column {c}.",
  hintSuppose: "Nothing follows directly. Look at row {r}, column {c}: suppose it is {wrong}, keep deducing, and the rules break. It has to be {v}.",
  hintSupposeNone: "Row {r}, column {c} has to be {v}: it is the only value the rules allow.",
  fillIn: "Fill it in",
  info: "notes",
  pickOne: "Pick a seal to read about its group.",
  hintMistake: "Row {r}, column {c} cannot be right. Clear it and try again.",
  conflictRow: "A value appears twice in a row.",
  conflictCol: "A value appears twice in a column.",
  conflictAssoc: "Associativity breaks: ({a}\xB7{b})\xB7{c} \u2260 {a}\xB7({b}\xB7{c}).",
  notGroupYet: "Every cell is filled, but this is not a group yet.",
  youMade: "You made",
  itIs: "This is",
  newFind: "new in your collection",
  abelian: "commutative",
  nonAbelian: "not commutative",
  elementsOfOrder: "elements by order",
  arrange: "Swap elements so that a normal subgroup comes first: the table falls into blocks, and the blocks are the quotient group.",
  chain: "Leading normal subgroups",
  chainNone: "none in this arrangement",
  quotient: "quotient",
  notFound: "not found yet",
  collectionIntro: "Every group with at most 12 elements. Solve a puzzle or build a table to find one.",
  copyLink: "copy a link to this puzzle",
  sound: "sound",
  on: "on",
  off: "off",
  hintsUsed: "hints"
};
var zh = {
  tagline: "\u586B\u4E00\u5F20\u4E58\u6CD5\u8868\uFF0C\u770B\u770B\u4F60\u9020\u51FA\u4E86\u54EA\u4E2A\u7FA4\u3002",
  puzzles: "\u8C1C\u9898",
  build: "\u81EA\u7531\u6784\u9020",
  collection: "\u56FE\u9274",
  easy: "\u5165\u95E8",
  normal: "\u666E\u901A",
  expert: "\u4E13\u5BB6",
  easyNote: "\u6BCF\u4E00\u683C\u90FD\u80FD\u7531\u4E24\u6761\u89C4\u5219\u76F4\u63A5\u63A8\u51FA\u3002",
  normalNote: "\u6709\u65F6\u8981\u5148\u5047\u8BBE\u4E00\u4E2A\u503C\uFF0C\u518D\u770B\u5B83\u8D70\u4E0D\u901A\u3002",
  expertNote: "\u4E00\u4E2A\u63D0\u793A\u90FD\u4E0D\u80FD\u518D\u5C11\u3002\u51E0\u4E2A\u683C\u5B50\uFF0C\u552F\u4E00\u4E00\u5F20\u8868\u3002",
  order: "\u9636",
  solved: "\u5DF2\u89E3",
  groupsFound: "\u5DF2\u53D1\u73B0",
  pickOrder: "\u51E0\u4E2A\u5143\u7D20\uFF1F",
  buildIntro: "\u4E00\u5F20\u7A7A\u8868\u3002\u628A\u5B83\u586B\u6210\u4E00\u4E2A\u7FA4\uFF0C\u968F\u4FBF\u54EA\u4E2A\uFF0C\u7136\u540E\u770B\u5B83\u662F\u8C01\u3002",
  rules: "\u89C4\u5219",
  rule1: "\u6BCF\u4E2A\u5143\u7D20\u5728\u6BCF\u4E00\u884C\u3001\u6BCF\u4E00\u5217\u5404\u51FA\u73B0\u4E00\u6B21\u3002",
  rule2: "\u5BF9\u4EFB\u610F a\u3001b\u3001c\uFF0C(a\xB7b)\xB7c = a\xB7(b\xB7c)\u3002",
  rulesMore: "\u8FD9\u5C31\u662F\u7FA4\u7684\u5168\u90E8\u5B9A\u4E49\u3002\u7B2C a \u884C\u7B2C b \u5217\u7684\u683C\u5B50\u662F a\xB7b\u3002",
  hint: "\u63D0\u793A",
  undo: "\u64A4\u9500",
  restart: "\u91CD\u6765",
  next: "\u6362\u4E00\u9898",
  back: "\u8FD4\u56DE",
  erase: "\u64E6\u9664",
  autofill: "\u81EA\u52A8\u63A8\u5BFC",
  autofillNote: "\u88AB\u89C4\u5219\u903C\u51FA\u6765\u7684\u683C\u5B50\u81EA\u52A8\u586B\u4E0A",
  element: "\u5143\u7D20",
  elOrder: "\u9636",
  elInverse: "\u9006\u5143",
  elCommutes: "\u4E0E\u4E4B\u4EA4\u6362",
  elConj: "\u5171\u8F6D",
  elIdentity: "\u5355\u4F4D\u5143",
  unknown: "?",
  pickCell: "\u5148\u9009\u4E00\u683C\uFF0C\u518D\u9009\u4E00\u4E2A\u503C\u3002\u70B9\u4E24\u4E2A\u8868\u5934\u53EF\u4EE5\u5BF9\u8C03\u4E24\u4E2A\u5143\u7D20\u3002",
  swapHint: "\u518D\u70B9\u53E6\u4E00\u4E2A\u8868\u5934\uFF0C\u5BF9\u8C03\u8FD9\u4E24\u4E2A\u5143\u7D20\u3002",
  hintCell: "\u7B2C {r} \u884C\u548C\u7B2C {c} \u5217\u91CC\uFF0C\u9664\u4E86 {v} \u90FD\u5DF2\u7ECF\u51FA\u73B0\u8FC7\u4E86\u3002",
  hintRow: "\u7B2C {r} \u884C\u91CC\uFF0C{v} \u53EA\u80FD\u653E\u5728\u7B2C {c} \u5217\u3002",
  hintCol: "\u7B2C {c} \u5217\u91CC\uFF0C{v} \u53EA\u80FD\u653E\u5728\u7B2C {r} \u884C\u3002",
  hintAssoc: "({a}\xB7{b})\xB7{c} = {a}\xB7({b}\xB7{c})\u3002\u8FD9\u91CC {a}\xB7{b} = {x}\uFF0C{b}\xB7{c} = {y}\uFF0C\u6240\u4EE5 {x}\xB7{c} \u548C {a}\xB7{y} \u662F\u540C\u4E00\u4E2A\u5143\u7D20\u3002\u5176\u4E2D\u4E00\u4E2A\u662F {v}\uFF0C\u53E6\u4E00\u4E2A\u4E5F\u662F\u3002",
  hintChain: "\u628A\u4E24\u6761\u89C4\u5219\u8FDE\u7528\u51E0\u6B21\uFF0C\u7B2C {r} \u884C\u7B2C {c} \u5217\u53EA\u5269\u4E0B {v}\u3002",
  hintSuppose: "\u6CA1\u6709\u80FD\u76F4\u63A5\u63A8\u51FA\u7684\u683C\u5B50\u3002\u770B\u7B2C {r} \u884C\u7B2C {c} \u5217\uFF1A\u5047\u8BBE\u5B83\u662F {wrong}\uFF0C\u63A5\u7740\u5F80\u4E0B\u63A8\uFF0C\u89C4\u5219\u5C31\u4F1A\u88AB\u6253\u7834\u3002\u6240\u4EE5\u5B83\u53EA\u80FD\u662F {v}\u3002",
  hintSupposeNone: "\u7B2C {r} \u884C\u7B2C {c} \u5217\u53EA\u80FD\u662F {v}\uFF1A\u89C4\u5219\u53EA\u5141\u8BB8\u8FD9\u4E00\u4E2A\u503C\u3002",
  fillIn: "\u586B\u5165",
  info: "\u8BF4\u660E",
  pickOne: "\u70B9\u4E00\u4E2A\u5370\u7AE0\uFF0C\u770B\u5B83\u662F\u54EA\u4E2A\u7FA4\u3002",
  hintMistake: "\u7B2C {r} \u884C\u7B2C {c} \u5217\u586B\u5F97\u4E0D\u5BF9\u3002\u64E6\u6389\u518D\u8BD5\u3002",
  conflictRow: "\u540C\u4E00\u884C\u91CC\u6709\u91CD\u590D\u7684\u503C\u3002",
  conflictCol: "\u540C\u4E00\u5217\u91CC\u6709\u91CD\u590D\u7684\u503C\u3002",
  conflictAssoc: "\u7ED3\u5408\u5F8B\u88AB\u6253\u7834\uFF1A({a}\xB7{b})\xB7{c} \u2260 {a}\xB7({b}\xB7{c})\u3002",
  notGroupYet: "\u683C\u5B50\u90FD\u586B\u6EE1\u4E86\uFF0C\u4F46\u8FD9\u8FD8\u4E0D\u662F\u4E00\u4E2A\u7FA4\u3002",
  youMade: "\u4F60\u9020\u51FA\u4E86",
  itIs: "\u8FD9\u662F",
  newFind: "\u65B0\u6536\u5165\u56FE\u9274",
  abelian: "\u4EA4\u6362",
  nonAbelian: "\u4E0D\u4EA4\u6362",
  elementsOfOrder: "\u5404\u9636\u5143\u7D20\u4E2A\u6570",
  arrange: "\u5BF9\u8C03\u5143\u7D20\uFF0C\u628A\u4E00\u4E2A\u6B63\u89C4\u5B50\u7FA4\u6392\u5230\u6700\u524D\u9762\uFF1A\u8868\u4F1A\u5206\u6210\u4E00\u5757\u4E00\u5757\uFF0C\u8FD9\u4E9B\u5757\u5C31\u662F\u5546\u7FA4\u3002",
  chain: "\u6392\u5728\u6700\u524D\u9762\u7684\u6B63\u89C4\u5B50\u7FA4",
  chainNone: "\u8FD9\u79CD\u6392\u6CD5\u4E0B\u6CA1\u6709",
  quotient: "\u5546\u7FA4",
  notFound: "\u8FD8\u6CA1\u53D1\u73B0",
  collectionIntro: "\u4E0D\u8D85\u8FC7 12 \u4E2A\u5143\u7D20\u7684\u5168\u90E8\u7FA4\u3002\u89E3\u4E00\u9053\u8C1C\u9898\u6216\u8005\u9020\u4E00\u5F20\u8868\u6765\u53D1\u73B0\u5B83\u4EEC\u3002",
  copyLink: "\u590D\u5236\u8FD9\u9053\u9898\u7684\u94FE\u63A5",
  sound: "\u97F3\u6548",
  on: "\u5F00",
  off: "\u5173",
  hintsUsed: "\u63D0\u793A"
};
var DICT = { en, zh };
var lang = "en";
var setLang = (l) => {
  lang = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
};
var getLang = () => lang;
function t(key, vars = {}) {
  return DICT[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
var orderOf = (n) => lang === "zh" ? `${n} \u9636` : `order ${n}`;
var ABOUT = {
  C: ["Cyclic: one element, multiplied by itself again and again, reaches every other.", "\u5FAA\u73AF\u7FA4\uFF1A\u4E00\u4E2A\u5143\u7D20\u4E0D\u65AD\u81EA\u4E58\uFF0C\u5C31\u80FD\u8D70\u904D\u5168\u4F53\u3002"],
  Cp: ["Cyclic, and the only group of this order: a prime number of elements leaves no other choice.", "\u5FAA\u73AF\u7FA4\u3002\u8FD9\u4E2A\u9636\u662F\u7D20\u6570\uFF0C\u6240\u4EE5\u8FD9\u4E2A\u9636\u7684\u7FA4\u53EA\u6709\u5B83\u4E00\u4E2A\u3002"],
  V4: ["The Klein four-group: every element undoes itself. The symmetries of a rectangle.", "\u514B\u83B1\u56E0\u56DB\u5143\u7FA4\uFF1A\u6BCF\u4E2A\u5143\u7D20\u90FD\u662F\u81EA\u5DF1\u7684\u9006\u5143\u3002\u957F\u65B9\u5F62\u7684\u5BF9\u79F0\u3002"],
  S3: ["The smallest group where order matters: all ways to rearrange three things, or the symmetries of a triangle.", "\u6700\u5C0F\u7684\u4E0D\u4EA4\u6362\u7684\u7FA4\uFF1A\u4E09\u6837\u4E1C\u897F\u7684\u5168\u90E8\u6392\u5217\uFF0C\u4E5F\u662F\u6B63\u4E09\u89D2\u5F62\u7684\u5BF9\u79F0\u3002"],
  C4xC2: ["A quarter turn and an independent switch.", "\u4E00\u4E2A\u56DB\u5206\u4E4B\u4E00\u8F6C\uFF0C\u52A0\u4E00\u4E2A\u72EC\u7ACB\u7684\u5F00\u5173\u3002"],
  C2xC2xC2: ["Three independent switches. Every element undoes itself.", "\u4E09\u4E2A\u4E92\u4E0D\u76F8\u5E72\u7684\u5F00\u5173\u3002\u6BCF\u4E2A\u5143\u7D20\u90FD\u662F\u81EA\u5DF1\u7684\u9006\u5143\u3002"],
  D4: ["The symmetries of a square: four rotations and four flips.", "\u6B63\u65B9\u5F62\u7684\u5BF9\u79F0\uFF1A\u56DB\u4E2A\u65CB\u8F6C\uFF0C\u56DB\u4E2A\u7FFB\u8F6C\u3002"],
  Q8: ["The quaternions \xB11, \xB1i, \xB1j, \xB1k. Only one element of order 2, every subgroup normal, and still not commutative.", "\u56DB\u5143\u6570 \xB11\u3001\xB1i\u3001\xB1j\u3001\xB1k\u3002\u53EA\u6709\u4E00\u4E2A 2 \u9636\u5143\u7D20\uFF0C\u6240\u6709\u5B50\u7FA4\u90FD\u6B63\u89C4\uFF0C\u5374\u4E0D\u4EA4\u6362\u3002"],
  C3xC3: ["Two independent third-turns. A group with p\xB2 elements always commutes.", "\u4E24\u4E2A\u4E92\u4E0D\u76F8\u5E72\u7684\u4E09\u5206\u4E4B\u4E00\u8F6C\u3002p\xB2 \u9636\u7684\u7FA4\u4E00\u5B9A\u4EA4\u6362\u3002"],
  D5: ["The symmetries of a regular pentagon.", "\u6B63\u4E94\u8FB9\u5F62\u7684\u5BF9\u79F0\u3002"],
  C6xC2: ["A sixth-turn and an independent switch.", "\u4E00\u4E2A\u516D\u5206\u4E4B\u4E00\u8F6C\uFF0C\u52A0\u4E00\u4E2A\u72EC\u7ACB\u7684\u5F00\u5173\u3002"],
  D6: ["The symmetries of a regular hexagon.", "\u6B63\u516D\u8FB9\u5F62\u7684\u5BF9\u79F0\u3002"],
  A4: ["The rotations of a tetrahedron. Twelve elements, yet no subgroup of six: the converse of Lagrange fails here.", "\u6B63\u56DB\u9762\u4F53\u7684\u65CB\u8F6C\u3002\u6709 12 \u4E2A\u5143\u7D20\uFF0C\u5374\u6CA1\u6709 6 \u9636\u5B50\u7FA4\uFF1A\u62C9\u683C\u6717\u65E5\u5B9A\u7406\u7684\u9006\u5728\u8FD9\u91CC\u4E0D\u6210\u7ACB\u3002"],
  Dic3: ["The dicyclic group: not commutative, with elements of order 4 and a single element of order 2.", "\u53CC\u5FAA\u73AF\u7FA4\uFF1A\u4E0D\u4EA4\u6362\uFF0C\u6709 4 \u9636\u5143\u7D20\uFF0C2 \u9636\u5143\u7D20\u53EA\u6709\u4E00\u4E2A\u3002"]
};
var PRIMES = /* @__PURE__ */ new Set([2, 3, 5, 7, 11]);
function about(id, order) {
  const row = ABOUT[id] ?? (PRIMES.has(order) ? ABOUT.Cp : ABOUT.C);
  return row[lang === "en" ? 0 : 1];
}

// src/game/words.ts
var L = (v) => LABELS[v];
function hintText(h) {
  const v = { r: h.r + 1, c: h.c + 1, v: L(h.v) };
  switch (h.kind) {
    case "cell":
      return t("hintCell", v);
    case "row":
      return t("hintRow", v);
    case "col":
      return t("hintCol", v);
    case "assoc":
      return t("hintAssoc", { a: L(h.a), b: L(h.b), c: L(h.c3), x: L(h.x), y: L(h.y), v: L(h.v) });
    case "chain":
      return t("hintChain", v);
    case "suppose":
      return h.wrong.length ? t("hintSuppose", { ...v, wrong: h.wrong.map(L).join(getLang() === "zh" ? " \u6216 " : " or ") }) : t("hintSupposeNone", v);
  }
}
function conflictText(c) {
  if (c.kind === "assoc") return t("conflictAssoc", { a: L(c.a), b: L(c.b), c: L(c.c) });
  return t(c.kind === "row" ? "conflictRow" : "conflictCol");
}

// cli/files.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var home = (dir2) => dir2 ?? process.env.SYMMETRY_HOME ?? path.join(os.homedir(), ".symmetry");
function fileStore(dir2, name, fallback) {
  const file = path.join(dir2, name);
  return {
    exists: () => fs.existsSync(file),
    load() {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        return fallback();
      }
    },
    save(value) {
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(value));
    },
    clear() {
      fs.rmSync(file, { force: true });
    }
  };
}

// cli/draw.ts
var hue = (v, n) => Math.round(v * 360 / n + 205) % 360;
function rgb(h, s, l) {
  const a = s * Math.min(l, 1 - l), f = (k) => {
    const x = (k + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1))));
  };
  return [f(0), f(8), f(4)];
}
var paint = (text, fg, bg, bold = false) => `\x1B[${bold ? "1;" : ""}38;2;${fg.join(";")}${bg ? `;48;2;${bg.join(";")}` : ""}m${text}\x1B[0m`;
function drawTable(s, colour2, marks = []) {
  const n = s.n, lines = [];
  const head = (v) => colour2 ? paint(` ${LABELS[v]} `, rgb(hue(v, n), 0.85, 0.72)) : ` ${LABELS[v]}`;
  lines.push((colour2 ? "   " : " \xB7 |") + [...Array(n).keys()].map(head).join(""));
  if (!colour2) lines.push("---+" + "--".repeat(n));
  for (let r = 0; r < n; r++) {
    let row = colour2 ? head(r) : `${head(r)} |`;
    for (let c = 0; c < n; c++) {
      const at = r * n + c, v = s.cells[at], mark = marks.includes(at);
      if (!colour2) row += v < 0 ? mark ? " ?" : " ." : ` ${LABELS[v]}`;
      else if (v < 0) row += paint(mark ? " ? " : " \xB7 ", mark ? [116, 192, 252] : [70, 76, 100], [22, 24, 36]);
      else row += paint(` ${LABELS[v]} `, s.given[at] ? [255, 255, 255] : [160, 215, 255], rgb(hue(v, n), 0.45, mark ? 0.42 : 0.28), !!s.given[at]);
    }
    lines.push(row);
  }
  return lines.join("\n");
}

// cli/main.ts
var HELP = `symmetry \u2014 fill in a multiplication table, find out which group you made

  symmetry                         play here, typing moves (needs a terminal)
  symmetry new [order] [easy|normal|expert]   start a puzzle   (--code 8-n-k3f9, --seed 42, --build for an empty table)
  symmetry show                    the table as it stands
  symmetry put A B C               write A\xB7B = C               (also: symmetry "A*B=C")
  symmetry erase A B               clear the cell A\xB7B
  symmetry swap X Y                exchange the numbers of two elements
  symmetry hint [--fill]           the next step and why; --fill also writes it
  symmetry undo | restart
  symmetry facts X                 what the table says about element X
  symmetry rate                    how hard the current puzzle is, by the layered solver
  symmetry progress                the groups found so far
  symmetry audit [--orders 4,8] [--count 20]   what the generator really produces, per group and difficulty
  symmetry rules

  --json     machine-readable output          --plain    no colour
  --home D   keep state in D (default ~/.symmetry, or $SYMMETRY_HOME)      --lang en|zh

The rules: each element appears once in every row and every column, and (a\xB7b)\xB7c = a\xB7(b\xB7c).
The saved table never contains the solution.`;
var argv = process.argv.slice(2);
var flags = {};
var words = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    if (["home", "lang", "code", "seed", "orders", "count"].includes(k)) flags[k] = argv[++i] ?? "";
    else flags[k] = true;
  } else words.push(a);
}
setLang(flags.lang === "zh" || !flags.lang && /^zh/i.test(process.env.LANG ?? "") ? "zh" : "en");
var json = !!flags.json;
var colour = !json && !flags.plain && !!process.stdout.isTTY && !process.env.NO_COLOR;
var dir = home(typeof flags.home === "string" ? flags.home : void 0);
var tableFile = fileStore(dir, "table.json", () => void 0);
var progressFile = fileStore(dir, "progress.json", emptyProgress);
var label = (text, n) => {
  const v = LABELS.indexOf(text.toUpperCase());
  return text.length === 1 && v >= 0 && v < n ? v : -1;
};
var Refused = class extends Error {
};
var refuse = (why) => {
  throw new Refused(why);
};
function describe(s) {
  const filled = s.cells.filter((v) => v >= 0).length;
  const what = s.mode === "build" ? `${t("build")} \xB7 ${orderOf(s.n)}` : `${orderOf(s.n)} \xB7 ${s.solved ? s.solved.name : "???"} \xB7 ${t(s.difficulty)}${s.code ? ` \xB7 #${s.code}` : ""}`;
  return `${what} \xB7 ${filled}/${s.n * s.n}${s.hints ? ` \xB7 ${t("hintsUsed")} ${s.hints}` : ""}`;
}
function print(r) {
  const s = r.session;
  if (json) {
    const n = s?.n ?? 0, rows = s ? [...Array(n).keys()].map((a) => [...Array(n).keys()].map((b) => s.cells[a * n + b] < 0 ? null : LABELS[s.cells[a * n + b]])) : void 0;
    console.log(JSON.stringify({ ok: r.ok, message: r.message, ...s ? {
      order: n,
      mode: s.mode,
      difficulty: s.difficulty,
      code: s.code,
      elements: [...LABELS.slice(0, n)],
      table: rows,
      given: [...Array(n).keys()].map((a) => [...Array(n).keys()].map((b) => !!s.given[a * n + b])),
      filled: s.cells.filter((v) => v >= 0).length,
      cells: n * n,
      conflicts: inspect(s).conflicts.map(conflictText),
      solved: !!s.solved,
      group: s.solved ? { id: s.solved.id, name: s.solved.name } : null,
      hints: s.hints
    } : {}, ...r.extra }));
    return;
  }
  if (s) console.log(`${describe(s)}

${drawTable(s, colour, r.marks)}
`);
  if (r.message) console.log(r.message);
}
function current() {
  const saved = tableFile.load();
  return saved ? fromJSON(saved) : refuse("No table yet. Start one with: symmetry new 6");
}
function after(s, r) {
  if (r.conflicts.length) return conflictText(r.conflicts[0]);
  if (!r.won) return "";
  const p = progressFile.load(), got = recordSolve(p, s, r.won);
  progressFile.save(p);
  const also = got.newSubgroups.length ? ` (${t("newFind")}: ${got.newSubgroups.map((g) => g.name).join(", ")})` : "";
  return `${t(s.mode === "puzzle" ? "itIs" : "youMade")} ${r.won.name}${got.isNew ? ` \u2014 ${t("newFind")}` : ""}${also}. ${about(r.won.id, s.n)}`;
}
function run(cmd, args) {
  const move = /^([0-9a-z])\s*[*·.x]\s*([0-9a-z])\s*=\s*([0-9a-z.?])$/i.exec([cmd, ...args].join(""));
  if (move) {
    args = [move[1], move[2], move[3]];
    cmd = /[.?]/.test(move[3]) ? "erase" : "put";
  } else if (/^[0-9a-z]$/i.test(cmd) && args.length === 2) {
    args = [cmd, ...args];
    cmd = "put";
  }
  switch (cmd) {
    case "new": {
      const named = typeof flags.code === "string" ? parseCode(flags.code) ?? refuse(`Not a puzzle code: ${flags.code}`) : void 0;
      const n = named?.n ?? +(args.find((a) => /^\d+$/.test(a)) ?? 6);
      if (!groupsOfOrder(n).length) refuse(`Orders ${ORDERS[0]} to ${ORDERS[ORDERS.length - 1]} are available.`);
      const difficulty = named?.difficulty ?? args.find((a) => DIFFICULTIES.includes(a)) ?? "easy";
      const seed = named?.seed ?? (typeof flags.seed === "string" ? +flags.seed >>> 0 : void 0);
      const s = flags.build ? newBuild(n) : newPuzzle(n, difficulty, seed) ?? refuse(`There is no ${difficulty} puzzle with ${n} elements: nothing at that size is that hard.`);
      tableFile.save(toJSON(s));
      return { ok: true, message: `${t("rule1")} ${t("rule2")}`, session: s };
    }
    case "show":
      return { ok: true, message: "", session: current() };
    case "put":
    case "erase": {
      const s = current(), [a, b] = [label(args[0] ?? "", s.n), label(args[1] ?? "", s.n)], v = cmd === "erase" ? -1 : label(args[2] ?? "", s.n);
      if (a < 0 || b < 0 || cmd === "put" && v < 0) refuse(`Elements are ${LABELS.slice(0, s.n).split("").join(" ")}. Usage: symmetry put A B C  (A\xB7B = C)`);
      const at = a * s.n + b;
      if (s.solved) refuse("This table is finished. Start another with: symmetry new");
      if (s.given[at]) refuse(`${LABELS[a]}\xB7${LABELS[b]} is given and cannot be changed.`);
      const r = place(s, at, v) ?? refuse("Nothing to change there.");
      tableFile.save(toJSON(s));
      return { ok: !r.conflicts.length, message: after(s, r), session: s };
    }
    case "swap": {
      const s = current(), [x, y] = [label(args[0] ?? "", s.n), label(args[1] ?? "", s.n)];
      if (x < 0 || y < 0 || x === y) refuse("Usage: symmetry swap X Y");
      swapElements(s, x, y);
      let message = "";
      if (s.solved) {
        const p = progressFile.load(), fresh = recordArrangement(p, s);
        progressFile.save(p);
        if (fresh.length) message = `${t("newFind")}: ${fresh.map((g) => g.name).join(", ")}`;
      }
      tableFile.save(toJSON(s));
      return { ok: true, message, session: s };
    }
    case "hint": {
      const s = current();
      if (s.mode === "build") refuse("There are no hints when building: any group will do.");
      const a = advise(s) ?? refuse("Nothing left to hint at.");
      if (a.kind === "mistake") return { ok: true, message: t("hintMistake", { r: Math.floor(a.at / s.n) + 1, c: a.at % s.n + 1 }), session: s, marks: [a.at], extra: { hint: { kind: "mistake", row: Math.floor(a.at / s.n), column: a.at % s.n } } };
      const h = a.hint, at = h.r * s.n + h.c;
      let message = hintText(h);
      if (flags.fill) {
        const r = place(s, at, h.v);
        message += " " + after(s, r);
      }
      tableFile.save(toJSON(s));
      return { ok: true, message, session: s, marks: flags.fill ? [] : [at], extra: { hint: { kind: h.kind, row: LABELS[h.r], column: LABELS[h.c], value: LABELS[h.v] } } };
    }
    case "undo": {
      const s = current();
      if (!undo(s)) refuse("Nothing to undo.");
      tableFile.save(toJSON(s));
      return { ok: true, message: "", session: s };
    }
    case "restart": {
      const s = current();
      restart(s);
      tableFile.save(toJSON(s));
      return { ok: true, message: "", session: s };
    }
    case "facts": {
      const s = current(), x = label(args[0] ?? "", s.n);
      if (x < 0) refuse("Usage: symmetry facts X");
      const f = elementFacts(s.n, s.cells, x), list = (xs) => xs.map((v) => LABELS[v]).join(" ") || "?";
      const lines = { [t("elOrder")]: f.order ?? "?", [t("elInverse")]: f.inverse === void 0 ? "?" : LABELS[f.inverse], [t("elCommutes")]: list(f.commutesWith), [t("elConj")]: list(f.conjugates) };
      return { ok: true, message: `${t("element")} ${LABELS[x]}
` + Object.entries(lines).map(([k, v]) => `  ${k}: ${v}`).join("\n"), extra: { facts: lines } };
    }
    case "rate": {
      const s = current(), givens = cluesOf(s.cells.map((v, i) => s.given[i] ? v : -1), s.n), r = rate(s.n, givens);
      const words2 = ["", "rows and columns alone", "rows, columns and associativity", `supposing, ${r.supposes} time${r.supposes === 1 ? "" : "s"}`, "more than one supposition at a time"][r.level];
      return { ok: true, message: `${givens.length} givens. The layered solver needs: ${words2}.`, extra: { rating: { givens: givens.length, level: r.level, supposes: r.supposes } } };
    }
    case "progress": {
      const p = progressFile.load();
      const lines = ORDERS.map((n) => `  ${String(n).padStart(2)}  ${groupsOfOrder(n).map((g) => p.found.includes(g.id) ? g.name : "???").join("  ")}`);
      return { ok: true, message: `${p.found.length} / ${GROUPS.length}
${lines.join("\n")}`, extra: { found: p.found.map((id) => groupById(id).name), solved: p.solved } };
    }
    case "audit":
      return audit();
    case "rules":
      return { ok: true, message: `1. ${t("rule1")}
2. ${t("rule2")}
${t("rulesMore")}` };
    case "help":
    case void 0:
      return { ok: true, message: HELP };
    default:
      return refuse(`Unknown command: ${cmd}. Try: symmetry help`);
  }
}
function audit() {
  const orders = typeof flags.orders === "string" ? flags.orders.split(",").map(Number) : ORDERS;
  const count = typeof flags.count === "string" ? +flags.count : 20;
  const rng = mulberry32(2022), lines = [], data = [];
  const mid = (xs) => xs.length ? xs.sort((a, b) => a - b)[xs.length >> 1] : "-";
  for (const n of orders) for (const g of groupsOfOrder(n)) {
    const row = [];
    for (const d of DIFFICULTIES) {
      const plain = [], shrewd = [], givens = [];
      let made = 0, deep = 0;
      for (let k = 0; k < count; k++) {
        const p = generateFor(g, d, rng);
        if (!p) continue;
        made++;
        givens.push(p.givens.length);
        const a = rate(n, p.givens), b = rate(n, p.givens, true);
        if (a.level === 3) plain.push(a.supposes);
        if (b.level === 3) shrewd.push(b.supposes);
        else if (b.level > 3) deep++;
      }
      row.push(`${d} ${String(made).padStart(2)}/${count}  givens ${String(mid(givens)).padStart(2)}  supposes ${String(mid(plain)).padStart(3)} \u2192 ${String(mid(shrewd)).padStart(3)}${deep ? ` (+${deep} deeper)` : ""}`.padEnd(54));
      data.push({ order: n, group: g.id, difficulty: d, made, of: count, medianGivens: mid(givens), medianSupposes: mid(plain), medianSupposesWithTheorems: mid(shrewd), beyond: deep });
    }
    lines.push(`${String(n).padStart(2)} ${g.name.padEnd(9)} ${row.join(" | ")}`);
  }
  return { ok: true, message: `Per group and difficulty: puzzles made out of ${count} asked for, median givens, and median suppositions needed
without \u2192 with the theorem shortcuts ("deeper": one supposition at a time is not enough).
` + lines.join("\n"), extra: { audit: data } };
}
function once(cmd, args) {
  try {
    const r = run(cmd, args);
    print(r);
    return r.ok;
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    print({ ok: false, message: e.message });
    return false;
  }
}
if (words.length || !process.stdin.isTTY) {
  process.exitCode = once(words[0] ?? "help", words.slice(1)) ? 0 : 1;
} else {
  if (!tableFile.exists()) once("new", []);
  else once("show", []);
  console.log("Moves look like 2*6=7. Also: hint, undo, swap 1 2, facts 3, new 8 normal, quit.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
  rl.prompt();
  rl.on("line", (line) => {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (["quit", "exit", "q"].includes(parts[0])) return rl.close();
    if (parts.length) {
      delete flags.fill;
      if (parts.includes("--fill")) flags.fill = true;
      once(parts[0] === "h" ? "hint" : parts[0], parts.slice(1).filter((p) => !p.startsWith("--")));
    }
    rl.prompt();
  });
}
