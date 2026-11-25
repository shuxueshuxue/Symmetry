"""Draws the pictures in docs/: header.svg, two-cells.svg and one-rule.svg.

    python3 -I docs/art/make.py

A hand sketch: strokes wobble a little, fills are pencil hatching, labels are
handwritten. The randomness is seeded, so every run draws the same picture.
The drawing kit is the one from github.com/shuxueshuxue/meant.
"""
import base64, math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.dirname(HERE)
FONTS_DIR = os.path.join(os.path.dirname(DOCS), "public", "fonts")

INK, SOFT = "#1e1e1e", "#868e96"
BLUE, BLUE_F = "#1971c2", "#a5d8ff"
PINK, PINK_F = "#c2255c", "#fcc2d7"
GREEN, GREEN_F = "#2f9e44", "#b2f2bb"
YELLOW_F, GREY_F = "#ffec99", "#e9ecef"
RED = "#e03131"
PAPER = "#fdfcf8"
MONO_ADVANCE = 0.6  # Cascadia Code, in ems


def font_face(name, file):
    data = base64.b64encode(open(os.path.join(FONTS_DIR, file), "rb").read()).decode()
    return f"@font-face{{font-family:'{name}';src:url(data:font/woff2;base64,{data}) format('woff2');}}"


FONTS = font_face("Virgil", "Virgil.woff2") + font_face("Cascadia", "Cascadia.woff2")
CLASSES = ".h{font-family:Virgil,cursive;fill:%s}.m{font-family:Cascadia,monospace;fill:%s;white-space:pre}" % (INK, INK)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Sketch:
    def __init__(self, w, h, seed):
        self.w, self.h, self.items, self.css = w, h, [], []
        self.r = random.Random(seed)

    def j(self, amt):
        return self.r.uniform(-amt, amt)

    def add(self, el, cls=None):
        if cls:
            el = el.replace("<", f'<g class="{cls}"><', 1) + "</g>"
        self.items.append(el)

    def line(self, x1, y1, x2, y2, color=INK, width=2.2, rough=1.2, passes=2, cls=None):
        out = ""
        for _ in range(passes):
            bow = min(math.hypot(x2 - x1, y2 - y1) * 0.012, 3) * rough
            mx, my = (x1 + x2) / 2 + self.j(bow), (y1 + y2) / 2 + self.j(bow)
            out += (f'<path d="M{x1 + self.j(rough):.1f},{y1 + self.j(rough):.1f} Q{mx:.1f},{my:.1f} '
                    f'{x2 + self.j(rough):.1f},{y2 + self.j(rough):.1f}" fill="none" stroke="{color}" '
                    f'stroke-width="{width}" stroke-linecap="round"/>')
        self.add(out, cls)

    def rect(self, x, y, w, h, **k):
        o = 4  # a hand does not stop exactly at the corner
        self.line(x - o, y, x + w + self.j(o), y, **k)
        self.line(x + w, y - o, x + w, y + h + self.j(o), **k)
        self.line(x + w + o, y + h, x + self.j(o), y + h, **k)
        self.line(x, y + h + o, x, y + self.j(o), **k)

    def curve(self, pts, color=INK, width=2.2, cls=None):
        d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f} " + " ".join(
            f"Q{c[0]:.1f},{c[1]:.1f} {e[0]:.1f},{e[1]:.1f}" for c, e in zip(pts[1::2], pts[2::2]))
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>', cls)

    def arrow(self, x1, y1, cx, cy, x2, y2, color=INK, cls=None):
        for _ in range(2):
            self.curve([(x1 + self.j(1), y1 + self.j(1)), (cx + self.j(3), cy + self.j(3)), (x2, y2)], color, cls=cls)
        ang = math.atan2(y2 - cy, x2 - cx)
        for s in (-1, 1):
            a = ang + math.pi - s * 0.45
            self.line(x2, y2, x2 + 13 * math.cos(a), y2 + 13 * math.sin(a), color=color, passes=1, cls=cls)

    def circle(self, cx, cy, r, color=INK, fill="none", cls=None):
        out = ""
        for _ in range(2):
            start = self.r.uniform(0, 6.28)
            pts = [(cx + (r + self.j(1.2)) * math.cos(start + i / 18 * 2.08 * math.pi),
                    cy + (r + self.j(1.2)) * math.sin(start + i / 18 * 2.08 * math.pi)) for i in range(19)]
            out += (f'<path d="M' + " L".join(f"{a:.1f},{b:.1f}" for a, b in pts) +
                    f'" fill="{fill}" stroke="{color}" stroke-width="1.8" stroke-linejoin="round"/>')
            fill = "none"
        self.add(out, cls)

    def hatch(self, pts, color, gap=7, slope=1.15):
        """Pencil hatching clipped to a slightly irregular outline."""
        cid = f"c{len(self.items)}"
        poly = " ".join(f"{a + self.j(2):.1f},{b + self.j(2):.1f}" for a, b in pts)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys) - 4, max(ys) + 4
        rise = (y1 - y0) / slope
        strokes, k = [], x0 - rise
        while k < x1:
            strokes.append(f'<path d="M{k + self.j(1):.1f},{y1:.1f} L{k + rise + self.j(1):.1f},{y0:.1f}" '
                           f'stroke="{color}" stroke-width="2.2" stroke-linecap="round"/>')
            k += gap + self.j(1)
        self.add(f'<clipPath id="{cid}"><polygon points="{poly}"/></clipPath>'
                 f'<g clip-path="url(#{cid})">' + "".join(strokes) + "</g>")

    def box(self, x, y, w, h, fill, color=INK):
        self.hatch([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], fill)
        self.rect(x, y, w, h, color=color)

    def text(self, x, y, s, size=22, font="h", color=None, anchor="start", rot=0, cls=None, ident=None):
        fill = f' style="fill:{color}"' if color else ""
        tr = f' transform="rotate({rot} {x} {y})"' if rot else ""
        idattr = f' id="{ident}"' if ident else ""
        self.add(f'<text{idattr} x="{x:.1f}" y="{y:.1f}" class="{font}" font-size="{size}" '
                 f'text-anchor="{anchor}"{fill}{tr}>{esc(s)}</text>', cls)

    def svg(self):
        # ART_AT=<seconds> freezes the animation there, for checking frames.
        if os.environ.get("ART_AT"):
            self.css.append("*{animation-play-state:paused!important;animation-delay:-%ss!important}" % os.environ["ART_AT"])
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}"><style>{FONTS}{CLASSES}{"".join(self.css)}</style>'
                f'<rect width="100%" height="100%" fill="{PAPER}"/>' + "".join(self.items) + "</svg>")


def grid(s, x, y, n, u, **k):
    for i in range(n + 1):
        w = 2.2 if i in (0, n) else 1.4
        s.line(x, y + i * u, x + n * u, y + i * u, width=w, passes=2 if i in (0, n) else 1, **k)
        s.line(x + i * u, y, x + i * u, y + n * u, width=w, passes=2 if i in (0, n) else 1, **k)


def cell(s, x, y, u, r, c, fill):
    p = 5
    s.hatch([(x + c * u + p, y + r * u + p), (x + (c + 1) * u - p, y + r * u + p),
             (x + (c + 1) * u - p, y + (r + 1) * u - p), (x + c * u + p, y + (r + 1) * u - p)], fill)


def header():
    """A triangle and the six moves that leave it looking the same; the same six moves as a table.
    The triangle really turns: a third of a turn, a pause, and again."""
    s = Sketch(1280, 640, 8)
    s.text(96, 128, "symmetry", 68, "m")
    s.text(100, 172, "six moves, one table", 30, color=BLUE)

    cx, cy, R = 330, 430, 140
    pts = [(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a))) for a in (-90, 30, 150)]
    # the flip: an axis through the top corner (it stays put while the triangle turns)
    for k in range(10):
        y0 = cy - R - 48 + k * 30
        s.line(cx, y0, cx, y0 + 15, color=PINK, width=2, passes=1)
    s.text(cx + 16, cy + R * .5 + 64, "flip", 26, color=PINK)
    # the triangle, with a dot on each corner so the turn can be seen
    start = len(s.items)
    s.hatch(pts, YELLOW_F, gap=9)
    for i in range(3):
        s.line(*pts[i], *pts[(i + 1) % 3], width=2.4)
    for (px, py), ink, fill in zip(pts, (BLUE, PINK, GREEN), (BLUE_F, PINK_F, GREEN_F)):
        s.circle(px, py, 13, color=ink, fill=fill)
    turning = "".join(s.items[start:])
    del s.items[start:]
    s.items.append(f'<g class="tri">{turning}</g>')
    s.css.append(".tri{transform-box:view-box;transform-origin:%dpx %dpx;animation:turn 9s ease-in-out infinite}"
                 "@keyframes turn{0%%,22%%{transform:rotate(0)}33%%,55%%{transform:rotate(120deg)}"
                 "66%%,88%%{transform:rotate(240deg)}100%%{transform:rotate(360deg)}}"
                 "@media (prefers-reduced-motion:reduce){.tri{animation:none}}" % (cx, cy))
    # the turn
    a0, a1, rr = math.radians(-62), math.radians(14), R + 58
    mid = (a0 + a1) / 2
    s.arrow(cx + rr * math.cos(a0), cy + rr * math.sin(a0), cx + (rr + 30) * math.cos(mid), cy + (rr + 30) * math.sin(mid),
            cx + rr * math.cos(a1), cy + rr * math.sin(a1), color=BLUE)
    s.text(cx + (rr + 34) * math.cos(mid), cy + (rr + 34) * math.sin(mid) - 4, "turn", 26, color=BLUE)

    # the table: turns keep to their corners, flips to theirs
    u, tx, ty = 54, 790, 236
    for r in range(6):
        for c in range(6):
            cell(s, tx, ty, u, r, c, BLUE_F if (r < 3) == (c < 3) else PINK_F)
    grid(s, tx, ty, 6, u)
    s.line(tx + 3 * u, ty - 12, tx + 3 * u, ty + 6 * u + 12, width=3)
    s.line(tx - 12, ty + 3 * u, tx + 6 * u + 12, ty + 3 * u, width=3)
    s.arrow(cx + R + 150, cy + 30, 660, cy - 20, tx - 44, cy - 30, color=SOFT)
    s.text(1184, 606, "fill in the table, find the group", 22, color=SOFT, anchor="end")
    return s


def wrap(s, start, cls):
    """Everything drawn since `start` becomes one group with a class, so it can be animated together."""
    inner = "".join(s.items[start:])
    del s.items[start:]
    s.items.append(f'<g class="{cls}">{inner}</g>')


def two_cells():
    """Two given cells, and the one table they force, written in cell by cell."""
    s = Sketch(1280, 460, 5)
    u, top, lx, rx = 64, 96, 120, 800
    givens = ((1, 1), (2, 3))
    for r, c in givens:
        cell(s, lx, top, u, r, c, BLUE_F)
    grid(s, lx, top, 5, u)
    for r, c in givens:
        s.text(lx + (c + .5) * u, top + (r + .5) * u + 11, str((r + c) % 5), 32, anchor="middle")
    s.text(lx, 62, "two cells are given", 26, color=BLUE)
    s.arrow(lx + 5 * u + 50, top + 2.5 * u, 630, top + 1.8 * u, rx - 50, top + 2.5 * u, color=SOFT)
    s.text(630, top + 1.7 * u - 26, "only one group fits", 24, color=SOFT, anchor="middle")
    s.text(rx, 62, "so the whole table follows", 26, color=PINK)
    grid(s, rx, top, 5, u)
    # the shorthand must come before the per-cell delays, or it resets them
    s.css.append(".w{opacity:0;animation:write 11s linear infinite}"
                 "@keyframes write{0%{opacity:0}3%,78%{opacity:1}86%,100%{opacity:0}}"
                 "@media (prefers-reduced-motion:reduce){.w{animation:none;opacity:1}}")
    order = sorted(((r, c) for r in range(5) for c in range(5)), key=lambda rc: (rc not in givens, (rc[0] + rc[1]) % 5 != 0, rc))
    for i, (r, c) in enumerate(order):
        v, start = (r + c) % 5, len(s.items)
        if (r, c) in givens:
            cell(s, rx, top, u, r, c, BLUE_F)
        elif v == 0:
            cell(s, rx, top, u, r, c, PINK_F)
        s.text(rx + (c + .5) * u, top + (r + .5) * u + 11, str(v), 32, anchor="middle",
               color=None if (r, c) in givens or v == 0 else SOFT)
        if (r, c) not in givens:
            wrap(s, start, f"w w{i}")
            s.css.append(f".w{i}{{animation-delay:{1 + (i - 2) * .22:.2f}s}}")
    return s


def one_rule():
    """Associativity: bracket a, b, c either way and you land on the same cell."""
    s = Sketch(1280, 400, 3)
    y, w, h, xs = 150, 92, 92, (170, 370, 570)
    for x, lab in zip(xs, "abc"):
        s.box(x, y, w, h, GREY_F)
        s.text(x + w / 2, y + h / 2 + 12, lab, 36, anchor="middle")
    start = len(s.items)
    s.curve([(xs[0] + w / 2, y - 14), ((xs[0] + xs[1] + w) / 2, y - 92), (xs[1] + w / 2, y - 14)], BLUE, 2.6)
    s.text((xs[0] + xs[1] + w) / 2, y - 72, "these two first", 24, color=BLUE, anchor="middle")
    s.arrow((xs[0] + xs[1] + w) / 2 + 100, y - 66, 760, y - 120, 936, y + 16, color=BLUE)
    wrap(s, start, "way one")
    start = len(s.items)
    s.curve([(xs[1] + w / 2, y + h + 14), ((xs[1] + xs[2] + w) / 2, y + h + 92), (xs[2] + w / 2, y + h + 14)], PINK, 2.6)
    s.text((xs[1] + xs[2] + w) / 2, y + h + 96, "or these two first", 24, color=PINK, anchor="middle")
    s.arrow((xs[1] + xs[2] + w) / 2 + 120, y + h + 76, 830, y + h + 110, 936, y + h - 16, color=PINK)
    wrap(s, start, "way two")
    s.box(950, y, w, h, YELLOW_F)
    s.text(950 + w / 2, y + h / 2 + 12, "?", 36, anchor="middle")
    s.text(950 + w + 24, y + h / 2 + 8, "same cell", 24, color=SOFT)
    s.text(1184, 372, "(a·b)·c = a·(b·c)", 24, "m", color=SOFT, anchor="end")
    s.css.append(".way{animation:take 6s ease-in-out infinite}.two{animation-delay:-3s}"
                 "@keyframes take{0%,40%{opacity:1}50%,90%{opacity:.18}100%{opacity:1}}"
                 "@media (prefers-reduced-motion:reduce){.way{animation:none}}")
    return s


if __name__ == "__main__":
    for name, draw in (("header", header), ("two-cells", two_cells), ("one-rule", one_rule)):
        path = os.path.join(DOCS, name + ".svg")
        open(path, "w").write(draw().svg())
        print(path, os.path.getsize(path))
