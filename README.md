<p align="center"><img src="docs/header.svg" width="100%" alt="a triangle that turns and flips, six moves in all, next to the same six moves drawn as a table that falls into four blocks"></p>

# Symmetry

**A puzzle game about group theory: fill in a multiplication table and find out which group you made.**

### [▶ Play in the browser](https://shuxueshuxue.github.io/Symmetry/)

<p align="center"><img src="docs/two-cells.svg" width="100%" alt="a five by five table with only two cells given; an arrow; the same table completely filled in"></p>

**A few cells fix the whole table.** Every puzzle has exactly one solution, and you are not told
which group it is. Solve it and the game names it: there are 23 to collect.

<p align="center"><img src="docs/one-rule.svg" width="100%" alt="three boxes a, b, c; bracketing the first two or the last two leads to the same cell"></p>

**The rules are the axioms.** Each element once in every row and column, and `(a·b)·c = a·(b·c)`.
Hints say which of the two forces a cell.

Three difficulties, puzzles generated as you play, and a build mode that starts from an empty table.
English and 中文. Nothing to install.

```sh
npm install && npm run dev   # run it locally
npm test                     # the group theory core
python3 -I docs/art/make.py  # redraw the pictures
```

The first version, written in Python with pygame, is in this repository's history.
