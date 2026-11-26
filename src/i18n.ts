export type Lang = 'en' | 'zh'

const en = {
  tagline: 'Fill in a multiplication table. Find out which group you made.',
  puzzles: 'Puzzles', build: 'Build', collection: 'Collection',
  easy: 'Easy', normal: 'Normal', expert: 'Expert',
  easyNote: 'Every cell follows from the two rules.',
  normalNote: 'Sometimes you must suppose a value and see it fail.',
  expertNote: 'No given can be removed. Few cells, one table.',
  order: 'order', solved: 'solved', groupsFound: 'found',
  pickOrder: 'How many elements?',
  buildIntro: 'An empty table. Fill it so that it is a group, any group, and see which one it is.',
  rules: 'The rules',
  rule1: 'Each element appears once in every row and every column.',
  rule2: '(a·b)·c = a·(b·c), for every a, b, c.',
  rulesMore: 'That is the whole definition of a group. The cell in row a, column b is a·b.',
  hint: 'Hint', undo: 'Undo', restart: 'Restart', next: 'New puzzle', back: 'Back', erase: 'Erase',
  autofill: 'Fill what follows', autofillNote: 'cells forced by the rules fill themselves',
  element: 'Element', elOrder: 'order', elInverse: 'inverse', elCommutes: 'commutes with', elConj: 'conjugates', elIdentity: 'the identity',
  unknown: '?', pickCell: 'Pick a cell, then a value. Click two headers to swap two elements.',
  swapHint: 'Now click another header to swap the two elements.',
  hintCell: 'Row {r} and column {c} already contain every value except {v}.',
  hintRow: 'In row {r}, the value {v} can only go in column {c}.',
  hintCol: 'In column {c}, the value {v} can only go in row {r}.',
  hintAssoc: '({a}·{b})·{c} = {a}·({b}·{c}). Here {a}·{b} = {x} and {b}·{c} = {y}, so {x}·{c} and {a}·{y} are the same. One of them is {v}; so is the other.',
  hintChain: 'The two rules, applied a few times over, leave only {v} for row {r}, column {c}.',
  hintSuppose: 'Nothing follows directly. Look at row {r}, column {c}: suppose it is {wrong}, keep deducing, and the rules break. It has to be {v}.',
  hintSupposeNone: 'Row {r}, column {c} has to be {v}: it is the only value the rules allow.',
  fillIn: 'Fill it in', info: 'notes', pickOne: 'Pick a seal to read about its group.',
  hintMistake: 'Row {r}, column {c} cannot be right. Clear it and try again.',
  conflictRow: 'A value appears twice in a row.',
  conflictCol: 'A value appears twice in a column.',
  conflictAssoc: 'Associativity breaks: ({a}·{b})·{c} ≠ {a}·({b}·{c}).',
  notGroupYet: 'Every cell is filled, but this is not a group yet.',
  youMade: 'You made', itIs: 'This is', newFind: 'new in your collection', abelian: 'commutative', nonAbelian: 'not commutative',
  elementsOfOrder: 'elements by order',
  arrange: 'Swap elements so that a normal subgroup comes first: the table falls into blocks, and the blocks are the quotient group.',
  chain: 'Leading normal subgroups', chainNone: 'none in this arrangement', quotient: 'quotient',
  notFound: 'not found yet', collectionIntro: 'Every group with at most 12 elements. Solve a puzzle or build a table to find one.',
  copyLink: 'copy a link to this puzzle',
  sound: 'sound', on: 'on', off: 'off', hintsUsed: 'hints',
}

const zh: typeof en = {
  tagline: '填一张乘法表，看看你造出了哪个群。',
  puzzles: '谜题', build: '自由构造', collection: '图鉴',
  easy: '入门', normal: '普通', expert: '专家',
  easyNote: '每一格都能由两条规则直接推出。',
  normalNote: '有时要先假设一个值，再看它走不通。',
  expertNote: '一个提示都不能再少。几个格子，唯一一张表。',
  order: '阶', solved: '已解', groupsFound: '已发现',
  pickOrder: '几个元素？',
  buildIntro: '一张空表。把它填成一个群，随便哪个，然后看它是谁。',
  rules: '规则',
  rule1: '每个元素在每一行、每一列各出现一次。',
  rule2: '对任意 a、b、c，(a·b)·c = a·(b·c)。',
  rulesMore: '这就是群的全部定义。第 a 行第 b 列的格子是 a·b。',
  hint: '提示', undo: '撤销', restart: '重来', next: '换一题', back: '返回', erase: '擦除',
  autofill: '自动推导', autofillNote: '被规则逼出来的格子自动填上',
  element: '元素', elOrder: '阶', elInverse: '逆元', elCommutes: '与之交换', elConj: '共轭', elIdentity: '单位元',
  unknown: '?', pickCell: '先选一格，再选一个值。点两个表头可以对调两个元素。',
  swapHint: '再点另一个表头，对调这两个元素。',
  hintCell: '第 {r} 行和第 {c} 列里，除了 {v} 都已经出现过了。',
  hintRow: '第 {r} 行里，{v} 只能放在第 {c} 列。',
  hintCol: '第 {c} 列里，{v} 只能放在第 {r} 行。',
  hintAssoc: '({a}·{b})·{c} = {a}·({b}·{c})。这里 {a}·{b} = {x}，{b}·{c} = {y}，所以 {x}·{c} 和 {a}·{y} 是同一个元素。其中一个是 {v}，另一个也是。',
  hintChain: '把两条规则连用几次，第 {r} 行第 {c} 列只剩下 {v}。',
  hintSuppose: '没有能直接推出的格子。看第 {r} 行第 {c} 列：假设它是 {wrong}，接着往下推，规则就会被打破。所以它只能是 {v}。',
  hintSupposeNone: '第 {r} 行第 {c} 列只能是 {v}：规则只允许这一个值。',
  fillIn: '填入', info: '说明', pickOne: '点一个印章，看它是哪个群。',
  hintMistake: '第 {r} 行第 {c} 列填得不对。擦掉再试。',
  conflictRow: '同一行里有重复的值。',
  conflictCol: '同一列里有重复的值。',
  conflictAssoc: '结合律被打破：({a}·{b})·{c} ≠ {a}·({b}·{c})。',
  notGroupYet: '格子都填满了，但这还不是一个群。',
  youMade: '你造出了', itIs: '这是', newFind: '新收入图鉴', abelian: '交换', nonAbelian: '不交换',
  elementsOfOrder: '各阶元素个数',
  arrange: '对调元素，把一个正规子群排到最前面：表会分成一块一块，这些块就是商群。',
  chain: '排在最前面的正规子群', chainNone: '这种排法下没有', quotient: '商群',
  notFound: '还没发现', collectionIntro: '不超过 12 个元素的全部群。解一道谜题或者造一张表来发现它们。',
  copyLink: '复制这道题的链接',
  sound: '音效', on: '开', off: '关', hintsUsed: '提示',
}

const DICT = { en, zh }
export type Key = keyof typeof en

let lang: Lang = 'en'
export const setLang = (l: Lang) => { lang = l; if (typeof document !== 'undefined') document.documentElement.lang = l }
export const getLang = () => lang

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return DICT[lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
/** "order 8" / "8 阶" */
export const orderOf = (n: number) => (lang === 'zh' ? `${n} 阶` : `order ${n}`)

/** one line about each group */
const ABOUT: Record<string, [en: string, zh: string]> = {
  C: ['Cyclic: one element, multiplied by itself again and again, reaches every other.', '循环群：一个元素不断自乘，就能走遍全体。'],
  Cp: ['Cyclic, and the only group of this order: a prime number of elements leaves no other choice.', '循环群。这个阶是素数，所以这个阶的群只有它一个。'],
  V4: ['The Klein four-group: every element undoes itself. The symmetries of a rectangle.', '克莱因四元群：每个元素都是自己的逆元。长方形的对称。'],
  S3: ['The smallest group where order matters: all ways to rearrange three things, or the symmetries of a triangle.', '最小的不交换的群：三样东西的全部排列，也是正三角形的对称。'],
  C4xC2: ['A quarter turn and an independent switch.', '一个四分之一转，加一个独立的开关。'],
  C2xC2xC2: ['Three independent switches. Every element undoes itself.', '三个互不相干的开关。每个元素都是自己的逆元。'],
  D4: ['The symmetries of a square: four rotations and four flips.', '正方形的对称：四个旋转，四个翻转。'],
  Q8: ['The quaternions ±1, ±i, ±j, ±k. Only one element of order 2, every subgroup normal, and still not commutative.', '四元数 ±1、±i、±j、±k。只有一个 2 阶元素，所有子群都正规，却不交换。'],
  C3xC3: ['Two independent third-turns. A group with p² elements always commutes.', '两个互不相干的三分之一转。p² 阶的群一定交换。'],
  D5: ['The symmetries of a regular pentagon.', '正五边形的对称。'],
  C6xC2: ['A sixth-turn and an independent switch.', '一个六分之一转，加一个独立的开关。'],
  D6: ['The symmetries of a regular hexagon.', '正六边形的对称。'],
  A4: ['The rotations of a tetrahedron. Twelve elements, yet no subgroup of six: the converse of Lagrange fails here.', '正四面体的旋转。有 12 个元素，却没有 6 阶子群：拉格朗日定理的逆在这里不成立。'],
  Dic3: ['The dicyclic group: not commutative, with elements of order 4 and a single element of order 2.', '双循环群：不交换，有 4 阶元素，2 阶元素只有一个。'],
}
const PRIMES = new Set([2, 3, 5, 7, 11])
export function about(id: string, order: number): string {
  const row = ABOUT[id] ?? (PRIMES.has(order) ? ABOUT.Cp : ABOUT.C)
  return row[lang === 'en' ? 0 : 1]
}
