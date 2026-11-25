<p align="center"><img src="docs/header.svg" width="100%" alt="a triangle that turns and flips, six moves in all, next to the same six moves drawn as a table that falls into four blocks"></p>

# Symmetry

**A puzzle game about group theory: fill in a multiplication table and find out which group you made.**

### [▶ Play in the browser](https://shuxueshuxue.github.io/Symmetry/)

- **The rules are the axioms.** Each element once in every row and column, and `(a·b)·c = a·(b·c)`.
- **A few cells fix the whole table.** Two givens are enough for a 5×5 table. Every puzzle has one solution.
- **You are not told which group it is.** Solve it and the game names it: 23 groups to collect.
- **Three difficulties, endless puzzles.** They are generated as you play, and hints say which rule forces a cell.
- **Build mode.** Start from an empty table and see which group you end up with.

English and 中文. Nothing to install.

```sh
npm install && npm run dev   # run it locally
npm test                     # the group theory core
python3 -I docs/art/make.py  # redraw the picture above
```

The first version, written in Python with pygame, is in this repository's history.
