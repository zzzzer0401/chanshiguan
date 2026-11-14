// 关卡数据
// 地图符号：. 草地  # 灌木  F 栅栏  * 花坛（不可走）  ~ 泥坑  w 水洼  b 骨头零食
//          A 红顶小屋（第1天出发）  B 蓝顶小屋  S 柴犬  C 边牧  P 贵宾
import { createGame, solve } from './rules.js';

export const CHAPTERS = [
  { id: 1, name: '第一章 · 初次见面', sub: '一次只教一件事' },
  { id: 2, name: '第二章 · 三只都要宠', sub: '真正的硬核从这里开始' },
];

export const LEVELS = [
  {
    id: '1-1', chapter: 1, name: '回家的路', maxDays: 2, par: 1, tutorial: true,
    map: [
      '........',
      '.#....*.',
      '....S...',
      '........',
      '..#..#..',
      '.A....B.',
      '...**...',
      '........',
    ],
    pets: { shiba: { target: 3, moods: ['pet'] } },
    tips: [
      { who: 'player', text: '我是新来的铲屎官！每天有 10 点体力⚡，走一格花 1 点，喂食或摸摸花 2 点。' },
      { who: 'shiba', text: '记住铁律：每天必须回到【另一座】小屋！体力不够回家 = 今天白干，我会翻白眼的。' },
      { who: 'player', text: '棋盘上绿点 = 去了还能回家，红格 = 去了就回不了家。点格子就能走过去。' },
      { who: 'shiba', text: '哼，今天允许你摸摸我。走到我 2 格以内，点我，再点「摸摸」。然后回蓝顶小屋！' },
    ],
  },
  {
    id: '1-2', chapter: 1, name: '傲娇橘子', maxDays: 5, par: 4, tutorial: true,
    map: [
      '........',
      '..#..b..',
      '.....#..',
      '...S....',
      '.#..b...',
      '..A...#.',
      '......B.',
      'b...#...',
    ],
    pets: { shiba: { target: 10, moods: ['feed', 'pet', 'sulk', 'pet', 'feed'] } },
    tips: [
      { who: 'shiba', text: '本柴每天心情不一样，头顶的泡泡会告诉你：想吃、想摸，还是“哼！”' },
      { who: 'shiba', text: '想吃的时候只认零食🦴——先去踩骨头捡起来（最多带 3 个，每天刷新）。不对我的胃口，+0！' },
      { who: 'player', text: '“哼”的那天它谁也不理……那就顺路囤零食吧。点它可以看到明天的心情。' },
    ],
  },
  {
    id: '1-3', chapter: 1, name: '高冷芝麻', maxDays: 4, par: 3, tutorial: true,
    map: [
      '...#....',
      '.C...b..',
      '...*....',
      '.A...#..',
      '.....B..',
      '.#.S....',
      '...b....',
      '......#.',
    ],
    pets: { shiba: { target: 6, moods: ['pet', 'feed', 'pet', 'sulk'] }, collie: { target: 7 } },
    tips: [
      { who: 'collie', text: '……我是芝麻。我的好感每晚会 -1。如果你一整天都没理我，-2。' },
      { who: 'collie', text: '通关条件：某天回到家的那一刻，所有狗狗好感都达标。所以别让我掉下去。' },
    ],
  },
  {
    id: '1-4', chapter: 1, name: '洁癖棉花糖', maxDays: 3, par: 2, bag: 1, tutorial: true,
    map: [
      '...b....',
      '.#.#....',
      '..~P.w..',
      '.A~..B..',
      '..~.....',
      '.##.#...',
      '........',
      '........',
    ],
    pets: { poodle: { target: 10 } },
    tips: [
      { who: 'poodle', text: '离我远点！我只接受【上下左右紧挨着】的互动，斜着不行，隔一格也不行。' },
      { who: 'poodle', text: '踩过泥坑身上会脏，脏了我一律拒绝！水洼可以洗干净。' },
      { who: 'player', text: '背包里已经有 1 根零食了……今天用，还是留到明天？' },
    ],
  },
  {
    id: '2-1', chapter: 2, name: '三只都要宠', maxDays: 6, par: 5,
    map: [
      '....b...',
      '.#......',
      '..S..C#.',
      '........',
      '.A~..~B.',
      '..w.P...',
      '...#..b.',
      '........',
    ],
    pets: {
      shiba: { target: 6, moods: ['feed', 'pet', 'sulk', 'pet', 'feed'] },
      collie: { target: 5 },
      poodle: { target: 6 },
    },
    tips: [{ who: 'player', text: '三只一起上！每天 10 点体力不可能照顾所有狗，想清楚今天先宠谁。' }],
  },
  {
    id: '2-2', chapter: 2, name: '芝麻去散步', maxDays: 6, par: 5,
    map: [
      '........',
      '.b..#...',
      '..C...*.',
      '.#..~...',
      '.A....B.',
      '...#.w..',
      '..S..P..',
      '.....b..',
    ],
    pets: {
      shiba: { target: 5, moods: ['pet', 'sulk', 'feed', 'pet'] },
      collie: { target: 6, route: [[2, 2], [4, 2], [4, 5], [2, 5]] },
      poodle: { target: 6 },
    },
    tips: [{ who: 'collie', text: '我每晚都会去散步，地上的爪印是我明天的位置。提前规划路线吧。' }],
  },
  {
    id: '2-3', chapter: 2, name: '猜不透的橘子', maxDays: 6, par: 5,
    map: [
      '.b......',
      '...#....',
      '..S..C..',
      '..#...#.',
      '.A..~.B.',
      '..~..#..',
      '.b..P.~.',
      '...w....',
    ],
    pets: {
      shiba: { target: 7, moods: ['?feed', '?pet', 'sulk', '?feed', '?pet'] },
      collie: { target: 5 },
      poodle: { target: 6 },
    },
    tips: [{ who: 'shiba', text: '今天本柴的心情是“？”。想知道？走到我 2 格内再说。带不带零食，你自己赌～' }],
  },
  {
    id: '2-4', chapter: 2, name: '终极铲屎官', maxDays: 7, par: 6,
    map: [
      '..#.....',
      '..b.....',
      '.S.F.P*.',
      '.A~...B.',
      '..w..~..',
      '.#..C...',
      '..b.....',
      '.....#..',
    ],
    pets: {
      shiba: { target: 7, moods: ['?pet', 'feed', 'sulk', '?feed', 'pet', 'sulk'] },
      collie: { target: 7, route: [[4, 5], [3, 1], [4, 5], [6, 5]] },
      poodle: { target: 8 },
    },
    tips: [{ who: 'player', text: '最终考验：散步、心情、洁癖全都有。三星要零失误 + 标准天数内通关！' }],
  },
];

export function levelById(id) {
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
  return null;
}
export function nextLevel(id) {
  for (let i = 0; i < LEVELS.length - 1; i++) if (LEVELS[i].id === id) return LEVELS[i + 1];
  return null;
}

// ================= 每日挑战：按日期生成 + 求解器校验 =================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(d) {
  d = d || new Date();
  const m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

function tryGen(seed) {
  const R = mulberry32(seed);
  const ri = (n) => Math.floor(R() * n);
  const g = [];
  for (let y = 0; y < 8; y++) g.push('........'.split(''));
  const free = (x, y) => g[y][x] === '.';
  const put = (ch, cond) => {
    for (let k = 0; k < 200; k++) {
      const x = ri(8), y = ri(8);
      if (free(x, y) && (!cond || cond(x, y))) { g[y][x] = ch; return { x: x, y: y }; }
    }
    return null;
  };
  const A = { x: ri(3), y: 1 + ri(6) };
  g[A.y][A.x] = 'A';
  const B = put('B', (x, y) => { const d = Math.abs(x - A.x) + Math.abs(y - A.y); return d >= 4 && d <= 6 && x >= 4; });
  if (!B) return null;
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const near = (r) => (x, y) => Math.abs(x - mid.x) + Math.abs(y - mid.y) <= r;
  const pets = ['S', 'C', 'P'];
  for (let i = 0; i < pets.length; i++) if (!put(pets[i], near(4))) return null;
  const obs = ['#', '#', '#', 'F', '*'];
  const nObs = 7 + ri(4);
  for (let i = 0; i < nObs; i++) put(obs[ri(obs.length)]);
  const nMud = 2 + ri(3);
  for (let i = 0; i < nMud; i++) put('~', near(4));
  put('w', near(4));
  const nBone = 2 + ri(2);
  for (let i = 0; i < nBone; i++) put('b', near(5));
  const moodPool = ['feed', 'pet', 'pet', 'feed', 'sulk', '?feed', '?pet'];
  const moods = [];
  for (let i = 0; i < 5; i++) moods.push(moodPool[ri(moodPool.length)]);
  if (moods[0] === 'sulk') moods[0] = 'pet';
  return {
    id: 'daily', chapter: 0, name: '每日挑战', maxDays: 8, par: 8, daily: true,
    map: g.map((r) => r.join('')),
    pets: {
      shiba: { target: 5 + ri(3), moods: moods },
      collie: { target: 5 + ri(2) },
      poodle: { target: 6 + ri(3) },
    },
    tips: [],
  };
}

const dailyCache = {};
export function dailyLevel(key) {
  key = key || todayKey();
  if (dailyCache[key]) return dailyCache[key];
  let base = 0;
  for (let i = 0; i < key.length; i++) base = (base * 31 + key.charCodeAt(i)) | 0;
  for (let k = 0; k < 80; k++) {
    const def = tryGen(base + k * 7919);
    if (!def) continue;
    const r = solve(createGame(Object.assign({}, def, { maxDays: 7 })), 7);
    if (r.days && r.days >= 3 && r.days <= 6) {
      def.par = r.days;
      def.maxDays = r.days + 1;
      def.seed = base + k * 7919;
      dailyCache[key] = def;
      return def;
    }
  }
  // 兜底：用最后一关
  return LEVELS[LEVELS.length - 1];
}
