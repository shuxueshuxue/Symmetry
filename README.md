# Symmetry

**A puzzle game about group theory: fill in a multiplication table and find out which group you made.**

**[Play it in the browser](https://shuxueshuxue.github.io/Symmetry-A-Group-theory-Game/)**

- **The rules are the axioms.** Each element appears once in every row and column, and
  `(a·b)·c = a·(b·c)`. That is the whole definition of a group, and it is all you need to play.
- **A few cells fix the whole table.** Two given cells are enough to determine a 5×5 table;
  five are enough for the symmetries of a square. Every puzzle has exactly one solution.
- **You are not told which group it is.** Solve the table and the game names it and adds it
  to your collection: all 23 groups with at most 12 elements.
- **Three difficulties, every order open from the start.** Easy puzzles fall to the two rules
  alone. Normal ones need you to suppose a value and watch it fail. Expert ones cannot lose
  another given.
- **Hints explain themselves.** A hint says which rule forces the cell, with the elements involved.
- **Build mode.** Start from an empty table, make any group you like, and see which one it is.
- **Swap two elements** and the same group shows a different pattern. Bring a normal subgroup
  to the front and the table falls into blocks: the blocks are the quotient group.
- **Sound made from the table.** Every element is a note, and the music is the table being read
  cell by cell, so it fills in as you do.

English and 中文. Nothing to install, nothing sent anywhere; progress is kept in the browser.

## How puzzles are made

Puzzles are generated in the browser, so they do not repeat.

A puzzle is a set of given cells with exactly one completion to a group table. Uniqueness is
decided exactly, by searching every group of that order and every way of numbering its elements.
Difficulty is the highest kind of reasoning a puzzle forces:

| | reasoning needed | "cannot lose another given" means |
|---|---|---|
| Easy | rows, columns, associativity | one fewer, and the two rules no longer finish it |
| Normal | plus a few suppositions | one fewer, and it needs more suppositions than allowed |
| Expert | anything | one fewer, and there is a second solution |

The smallest possible puzzles, found by exhaustive search:

| group | cells | fewest givens |
|---|---|---|
| C₄, C₂×C₂ | 16 | 2 |
| C₅ | 25 | 2 |
| C₆, S₃ | 36 | 3 |
| C₇ | 49 | 3 |
| C₈ | 64 | 4 |
| C₄×C₂, D₄, Q₈ | 64 | 5 |
| C₂×C₂×C₂ | 64 | 6 |

## Development

```sh
npm install
npm run dev      # play locally
npm test         # the group theory core
npm run build    # static site in dist/
```

The core is in `src/core/`: `groups.ts` builds the catalogue, `solve.ts` decides uniqueness and
does the layered reasoning behind difficulty and hints, `generate.ts` makes puzzles.

The first version of this game, written in Python with pygame, is in the history of this repository.
