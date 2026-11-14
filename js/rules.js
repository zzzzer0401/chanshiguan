// 纯规则层：与渲染无关，可单独做求解/校验
export const N = 8;
export const STAMINA = 10;
export const COST_MOVE = 1;
export const COST_ACT = 2;
export const BAG_MAX = 3;

export const T = { GRASS: 0, BUSH: 1, FENCE: 2, FLOWER: 3, MUD: 4, WATER: 5 };
const BLOCKING = [false, true, true, true, false, false];

export const PET_DEFS = {
  shiba: {
    kind: 'shiba', name: '橘子', breed: '柴犬', trait: '傲娇', range: 2, feed: 4, pet: 3, color: '#FF9F43',
    rule: '每天心情不同，只接受它想要的那一种互动；不对它就“哼”，+0。',
  },
  collie: {
    kind: 'collie', name: '芝麻', breed: '边牧', trait: '高冷', range: 2, feed: 2, pet: 3, color: '#5D6B8A',
    rule: '好感每晚 -1；当天没理它，则 -2。达标要卡在回家那一刻。',
  },
  poodle: {
    kind: 'poodle', name: '棉花糖', breed: '贵宾犬', trait: '洁癖', range: 1, feed: 4, pet: 3, color: '#F48FB1',
    rule: '只接受上下左右紧挨着的互动；身上有泥，一律拒绝。',
  },
};
export const PET_ORDER = ['shiba', 'collie', 'poodle'];

export const MOOD_TEXT = { feed: '想吃', pet: '想摸', sulk: '哼！', hidden: '？' };

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const idx = (x, y) => y * N + x;

export function parseLevel(def) {
  const tiles = [];
  const bones = [];
  const houses = [null, null];
  const pets = [];
  for (let y = 0; y < N; y++) {
    const row = def.map[y];
    for (let x = 0; x < N; x++) {
      const ch = row[x];
      let t = T.GRASS;
      if (ch === '#') t = T.BUSH;
      else if (ch === 'F') t = T.FENCE;
      else if (ch === '*') t = T.FLOWER;
      else if (ch === '~') t = T.MUD;
      else if (ch === 'w') t = T.WATER;
      else if (ch === 'b') bones.push({ x: x, y: y });
      else if (ch === 'A') houses[0] = { x: x, y: y };
      else if (ch === 'B') houses[1] = { x: x, y: y };
      else if (ch === 'S') pets.push({ kind: 'shiba', x: x, y: y });
      else if (ch === 'C') pets.push({ kind: 'collie', x: x, y: y });
      else if (ch === 'P') pets.push({ kind: 'poodle', x: x, y: y });
      tiles.push(t);
    }
  }
  pets.sort((a, b) => PET_ORDER.indexOf(a.kind) - PET_ORDER.indexOf(b.kind));
  return { tiles: tiles, bones: bones, houses: houses, pets: pets };
}

export function createGame(def) {
  const L = parseLevel(def);
  const st = def.stamina || STAMINA;
  const s = {
    def: def,
    tiles: L.tiles,
    bones: L.bones,
    houses: L.houses,
    startIdx: 0,
    player: { x: L.houses[0].x, y: L.houses[0].y },
    stamina: st,
    maxStamina: st,
    bag: def.bag || 0,
    dirty: false,
    day: 1,
    maxDays: def.maxDays,
    bonesTaken: 0,
    pets: L.pets.map((p) => {
      const cfg = def.pets[p.kind] || {};
      return {
        kind: p.kind, x: p.x, y: p.y,
        aff: cfg.start || 0, target: cfg.target || 5,
        moods: cfg.moods || null, route: cfg.route || null, routeIdx: 0,
        fed: false, petted: false, touched: false, revealed: false, gainToday: 0,
      };
    }),
    fails: 0,
    status: 'play', // play | arrived | won | stranded | lost
    distHome: null,
    morning: null,
  };
  prepareDay(s);
  return s;
}

export function homeOf(s) { return s.houses[1 - s.startIdx]; }
export function startOf(s) { return s.houses[s.startIdx]; }

export function moodOf(s, pet) {
  if (!pet.moods) return null;
  return pet.moods[(s.day - 1) % pet.moods.length];
}
// 玩家能看到的心情：feed/pet/sulk/hidden
export function visibleMood(s, pet) {
  const m = moodOf(s, pet);
  if (!m) return null;
  if (m.charAt(0) === '?') return pet.revealed ? m.slice(1) : 'hidden';
  return m;
}
function actualMood(s, pet) {
  const m = moodOf(s, pet);
  return m && m.charAt(0) === '?' ? m.slice(1) : m;
}

export function inBounds(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
export function tileAt(s, x, y) { return s.tiles[idx(x, y)]; }
export function petAt(s, x, y) {
  for (let i = 0; i < s.pets.length; i++) if (s.pets[i].x === x && s.pets[i].y === y) return i;
  return -1;
}
export function boneAt(s, x, y) {
  for (let i = 0; i < s.bones.length; i++) if (s.bones[i].x === x && s.bones[i].y === y) return i;
  return -1;
}
export function boneVisible(s, i) { return !(s.bonesTaken & (1 << i)); }

export function passable(s, x, y) {
  if (!inBounds(x, y)) return false;
  if (BLOCKING[tileAt(s, x, y)]) return false;
  if (petAt(s, x, y) >= 0) return false;
  return true;
}

// BFS 距离；stopAt：到达该格后不再向外扩展（目标小屋 = 当天终点）
export function bfs(s, sx, sy, stopAt) {
  const d = new Array(N * N).fill(Infinity);
  const q = [idx(sx, sy)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const cx = c % N, cy = (c / N) | 0;
    if (stopAt && h > 0 && cx === stopAt.x && cy === stopAt.y) continue;
    for (let k = 0; k < 4; k++) {
      const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (!passable(s, nx, ny)) continue;
      const ni = idx(nx, ny);
      if (d[ni] !== Infinity) continue;
      d[ni] = d[c] + 1;
      q.push(ni);
    }
  }
  return d;
}

function revealCheck(s, ev) {
  for (let i = 0; i < s.pets.length; i++) {
    const p = s.pets[i];
    const m = moodOf(s, p);
    if (m && m.charAt(0) === '?' && !p.revealed) {
      if (Math.abs(p.x - s.player.x) + Math.abs(p.y - s.player.y) <= 2) {
        p.revealed = true;
        if (ev) ev.push({ t: 'reveal', pet: i, mood: m.slice(1) });
      }
    }
  }
}

export function prepareDay(s) {
  const h = homeOf(s);
  s.distHome = bfs(s, h.x, h.y, null);
  revealCheck(s, null);
  s.morning = snapshot(s);
}

export function snapshot(s) {
  return {
    player: { x: s.player.x, y: s.player.y },
    stamina: s.stamina, bag: s.bag, dirty: s.dirty, bonesTaken: s.bonesTaken, status: s.status,
    pets: s.pets.map((p) => ({ x: p.x, y: p.y, aff: p.aff, fed: p.fed, petted: p.petted, touched: p.touched, revealed: p.revealed, gainToday: p.gainToday, routeIdx: p.routeIdx })),
  };
}
export function restore(s, snap) {
  s.player = { x: snap.player.x, y: snap.player.y };
  s.stamina = snap.stamina; s.bag = snap.bag; s.dirty = snap.dirty; s.bonesTaken = snap.bonesTaken; s.status = snap.status;
  for (let i = 0; i < s.pets.length; i++) Object.assign(s.pets[i], snap.pets[i]);
}

export function homeDistNow(s) { return s.distHome[idx(s.player.x, s.player.y)]; }

// 可达与安全：safe = 去了还能回家
export function reachMap(s) {
  const home = homeOf(s);
  const dP = bfs(s, s.player.x, s.player.y, home);
  const out = [];
  for (let i = 0; i < N * N; i++) {
    const r = dP[i] <= s.stamina && dP[i] > 0;
    out.push({ d: dP[i], reach: r, safe: r && dP[i] + s.distHome[i] <= s.stamina });
  }
  return out;
}

// 点哪走哪：最短路，同长度时优先避开泥坑、顺路捡骨头
export function findPath(s, tx, ty) {
  const home = homeOf(s);
  const start = idx(s.player.x, s.player.y), goal = idx(tx, ty);
  if (start === goal) return null;
  const dist = new Array(N * N).fill(Infinity), prev = new Array(N * N).fill(-1), done = new Array(N * N).fill(false);
  dist[start] = 0;
  for (;;) {
    let c = -1, best = Infinity;
    for (let i = 0; i < N * N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; c = i; }
    if (c < 0 || c === goal) break;
    done[c] = true;
    const cx = c % N, cy = (c / N) | 0;
    if (c !== start && cx === home.x && cy === home.y) continue;
    for (let k = 0; k < 4; k++) {
      const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (!passable(s, nx, ny)) continue;
      const ni = idx(nx, ny);
      let w = 1;
      const t = tileAt(s, nx, ny);
      if (t === T.MUD && !s.dirty) w += 0.01;
      if (t === T.WATER && s.dirty) w -= 0.002;
      const b = boneAt(s, nx, ny);
      if (b >= 0 && boneVisible(s, b) && s.bag < BAG_MAX) w -= 0.001;
      if (dist[c] + w < dist[ni]) { dist[ni] = dist[c] + w; prev[ni] = c; }
    }
  }
  if (dist[goal] === Infinity) return null;
  const path = [];
  for (let c = goal; c !== start; c = prev[c]) path.unshift({ x: c % N, y: (c / N) | 0 });
  return path;
}

export function isStranded(s) {
  const h = homeOf(s);
  if (s.player.x === h.x && s.player.y === h.y) return false;
  return s.stamina < homeDistNow(s);
}

// 走一步（必须相邻且可走）
export function stepTo(s, x, y) {
  const ev = [];
  s.stamina -= COST_MOVE;
  s.player = { x: x, y: y };
  const t = tileAt(s, x, y);
  if (t === T.MUD && !s.dirty) { s.dirty = true; ev.push({ t: 'dirty' }); }
  if (t === T.WATER && s.dirty) { s.dirty = false; ev.push({ t: 'clean' }); }
  const b = boneAt(s, x, y);
  if (b >= 0 && boneVisible(s, b)) {
    if (s.bag < BAG_MAX) { s.bag++; s.bonesTaken |= (1 << b); ev.push({ t: 'bone', i: b }); }
    else ev.push({ t: 'bagfull' });
  }
  revealCheck(s, ev);
  afterSpend(s, ev);
  return ev;
}

function afterSpend(s, ev) {
  const h = homeOf(s);
  if (s.player.x === h.x && s.player.y === h.y) {
    let win = true;
    for (let i = 0; i < s.pets.length; i++) if (s.pets[i].aff < s.pets[i].target) win = false;
    s.status = win ? 'won' : 'arrived';
    ev.push({ t: win ? 'won' : 'arrived' });
  } else if (isStranded(s)) {
    s.status = 'stranded';
    ev.push({ t: 'stranded' });
  }
}

export function inRange(s, pet, px, py) {
  const d = Math.abs(pet.x - px) + Math.abs(pet.y - py);
  return d <= PET_DEFS[pet.kind].range;
}

// 互动预览：ok 能否执行；gain 预期收益；reason 说明；strand 是否会导致回不了家
export function actionInfo(s, pi, type) {
  const p = s.pets[pi];
  const def = PET_DEFS[p.kind];
  const r = { ok: true, gain: def[type], reason: '', strand: false };
  if (!inRange(s, p, s.player.x, s.player.y)) { r.ok = false; r.reason = def.range === 1 ? 'adjacent' : 'far'; return r; }
  if (type === 'feed' && s.bag <= 0) { r.ok = false; r.reason = 'nobone'; return r; }
  if ((type === 'feed' && p.fed) || (type === 'pet' && p.petted)) { r.ok = false; r.reason = 'done'; return r; }
  if (s.stamina < COST_ACT) { r.ok = false; r.reason = 'tired'; return r; }
  if (p.kind === 'shiba' && p.moods) {
    const m = actualMood(s, p);
    if (m === 'sulk') { r.gain = 0; r.reason = 'sulk'; }
    else if (m !== type) { r.gain = 0; r.reason = 'mismatch'; }
  }
  if (p.kind === 'poodle' && s.dirty) { r.gain = 0; r.reason = 'dirty'; }
  r.strand = s.stamina - COST_ACT < homeDistNow(s);
  return r;
}

export function doAction(s, pi, type) {
  const info = actionInfo(s, pi, type);
  const ev = [];
  if (!info.ok) return ev;
  const p = s.pets[pi];
  s.stamina -= COST_ACT;
  if (type === 'feed') s.bag--;
  if (info.gain > 0) {
    if (type === 'feed') p.fed = true; else p.petted = true;
    p.touched = true;
    p.aff += info.gain;
    p.gainToday += info.gain;
  }
  ev.push({ t: 'gain', pet: pi, type: type, gain: info.gain, reason: info.reason });
  afterSpend(s, ev);
  return ev;
}

// 夜间结算。failed=回巢失败（当天好感清零）
export function nightAdvance(s, failed) {
  const report = [];
  if (failed) {
    const lost = s.pets.map((p) => p.gainToday);
    restore(s, s.morning);
    s.fails++;
    for (let i = 0; i < s.pets.length; i++) if (lost[i] > 0) report.push({ pet: i, t: 'rollback', v: -lost[i] });
    for (let i = 0; i < s.pets.length; i++) { s.pets[i].touched = false; }
  }
  for (let i = 0; i < s.pets.length; i++) {
    const p = s.pets[i];
    if (p.kind === 'collie') {
      const dec = p.touched ? 1 : 2;
      const before = p.aff;
      p.aff = Math.max(0, p.aff - dec);
      if (before !== p.aff) report.push({ pet: i, t: 'decay', v: p.aff - before, cold: !p.touched });
    }
  }
  for (let i = 0; i < s.pets.length; i++) {
    const p = s.pets[i];
    if (p.route && p.route.length > 1) {
      const ni = (p.routeIdx + 1) % p.route.length;
      const nx = p.route[ni][0], ny = p.route[ni][1];
      let free = true;
      for (let j = 0; j < s.pets.length; j++) if (j !== i && s.pets[j].x === nx && s.pets[j].y === ny) free = false;
      if (free) { p.routeIdx = ni; p.x = nx; p.y = ny; report.push({ pet: i, t: 'walk' }); }
    }
    p.fed = false; p.petted = false; p.touched = false; p.revealed = false; p.gainToday = 0;
  }
  if (!failed) s.startIdx = 1 - s.startIdx;
  const st = startOf(s);
  s.player = { x: st.x, y: st.y };
  s.day++;
  s.stamina = s.maxStamina;
  s.dirty = false;
  s.bonesTaken = 0;
  s.status = s.day > s.maxDays ? 'lost' : 'play';
  prepareDay(s);
  return report;
}

export function nextPos(pet) {
  if (!pet.route || pet.route.length < 2) return null;
  const ni = (pet.routeIdx + 1) % pet.route.length;
  return { x: pet.route[ni][0], y: pet.route[ni][1] };
}

export function allMet(s) {
  for (let i = 0; i < s.pets.length; i++) if (s.pets[i].aff < s.pets[i].target) return false;
  return true;
}

// ================= 求解器：计算“今天”的最优行动方案 =================
// 用于提示系统，以及关卡 / 每日挑战的可解性校验
export function planDay(s) {
  const home = homeOf(s);
  const homeI = idx(home.x, home.y);
  const dH = s.distHome;
  const pets = s.pets;
  const np = pets.length;
  let initFlags = 0;
  const allowFeed = [], allowPet = [], gFeed = [], gPet = [], needClean = [];
  for (let i = 0; i < np; i++) {
    const p = pets[i];
    if (p.fed) initFlags |= 1 << (2 * i);
    if (p.petted) initFlags |= 1 << (2 * i + 1);
    const d = PET_DEFS[p.kind];
    gFeed.push(d.feed); gPet.push(d.pet);
    let af = true, ap = true;
    if (p.kind === 'shiba' && p.moods) {
      const m = actualMood(s, p);
      af = m === 'feed'; ap = m === 'pet';
    }
    allowFeed.push(af); allowPet.push(ap);
    needClean.push(p.kind === 'poodle');
  }
  const rangeTiles = [];
  for (let i = 0; i < np; i++) {
    const arr = new Array(N * N).fill(false);
    for (let c = 0; c < N * N; c++) arr[c] = inRange(s, pets[i], c % N, (c / N) | 0);
    rangeTiles.push(arr);
  }
  const boneIdx = new Array(N * N).fill(-1);
  for (let b = 0; b < s.bones.length; b++) boneIdx[idx(s.bones[b].x, s.bones[b].y)] = b;
  const pass = new Array(N * N);
  for (let c = 0; c < N * N; c++) pass[c] = passable(s, c % N, (c / N) | 0);

  function terminal(flags, st, bag) {
    let win = true, val = 0;
    for (let i = 0; i < np; i++) {
      const p = pets[i];
      let g = 0;
      const fb = 1 << (2 * i), pb = 1 << (2 * i + 1);
      if ((flags & fb) && !(initFlags & fb)) g += gFeed[i];
      if ((flags & pb) && !(initFlags & pb)) g += gPet[i];
      const arr = p.aff + g;
      if (arr < p.target) win = false;
      const touched = p.touched || (flags & (fb | pb));
      const dec = p.kind === 'collie' ? (touched ? 1 : 2) : 0;
      const cap = p.target + (p.kind === 'collie' ? 1 : 0);
      const proj = arr - dec;
      // 离目标越远，每点好感越值钱
      val += Math.min(proj, cap) + (proj < p.target ? 0 : 0.2);
    }
    if (win) return 10000 + st * 0.1 + bag * 0.1;
    return val + bag * 0.45 + st * 0.01;
  }

  const memo = new Map();
  function best(pos, st, bag, dirty, flags, bones) {
    const key = ((((bones * 64 + flags) * 2 + dirty) * 4 + bag) * 11 + st) * 64 + pos;
    const m = memo.get(key);
    if (m) return m;
    let bv = -Infinity, bc = null;
    const px = pos % N, py = (pos / N) | 0;
    // 互动
    if (st - COST_ACT >= dH[pos]) {
      for (let i = 0; i < np; i++) {
        if (!rangeTiles[i][pos]) continue;
        if (needClean[i] && dirty) continue;
        const fb = 1 << (2 * i), pb = 1 << (2 * i + 1);
        if (allowFeed[i] && bag > 0 && !(flags & fb)) {
          const r = best(pos, st - COST_ACT, bag - 1, dirty, flags | fb, bones);
          if (r.v > bv) { bv = r.v; bc = { t: 'act', pet: i, type: 'feed', next: r }; }
        }
        if (allowPet[i] && !(flags & pb)) {
          const r = best(pos, st - COST_ACT, bag, dirty, flags | pb, bones);
          if (r.v > bv) { bv = r.v; bc = { t: 'act', pet: i, type: 'pet', next: r }; }
        }
      }
    }
    // 移动
    for (let k = 0; k < 4; k++) {
      const nx = px + DIRS[k][0], ny = py + DIRS[k][1];
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!pass[ni]) continue;
      const nst = st - COST_MOVE;
      if (nst < dH[ni]) continue;
      if (ni === homeI) {
        const v = terminal(flags, nst, bag);
        if (v > bv) { bv = v; bc = { t: 'move', x: nx, y: ny, next: null }; }
        continue;
      }
      let nd = dirty, nb = bag, nbones = bones;
      const t = s.tiles[ni];
      if (t === T.MUD) nd = 1; else if (t === T.WATER) nd = 0;
      const b = boneIdx[ni];
      if (b >= 0 && !(nbones & (1 << b)) && nb < BAG_MAX) { nb++; nbones |= 1 << b; }
      const r = best(ni, nst, nb, nd, flags, nbones);
      if (r.v > bv) { bv = r.v; bc = { t: 'move', x: nx, y: ny, next: r }; }
    }
    const res = { v: bv, c: bc };
    memo.set(key, res);
    return res;
  }

  const root = best(idx(s.player.x, s.player.y), s.stamina, s.bag, s.dirty ? 1 : 0, initFlags, s.bonesTaken);
  if (root.v === -Infinity) return null;
  const steps = [];
  let node = root;
  while (node && node.c) {
    const c = node.c;
    if (c.t === 'move') steps.push({ t: 'move', x: c.x, y: c.y });
    else steps.push({ t: 'act', pet: c.pet, type: c.type });
    node = c.next;
  }
  return { steps: steps, value: root.v, win: root.v >= 10000 };
}

// 枚举“今天”所有可能的回家结局（互动组合 × 背包），每种结局附带一条可行路线
export function dayOutcomes(s) {
  const home = homeOf(s);
  const homeI = idx(home.x, home.y);
  const dH = s.distHome;
  const pets = s.pets;
  const np = pets.length;
  let initFlags = 0;
  const allowFeed = [], allowPet = [], needClean = [], rangeTiles = [];
  for (let i = 0; i < np; i++) {
    const p = pets[i];
    if (p.fed) initFlags |= 1 << (2 * i);
    if (p.petted) initFlags |= 1 << (2 * i + 1);
    let af = true, ap = true;
    if (p.kind === 'shiba' && p.moods) { const m = actualMood(s, p); af = m === 'feed'; ap = m === 'pet'; }
    allowFeed.push(af); allowPet.push(ap); needClean.push(p.kind === 'poodle');
    const arr = new Array(N * N);
    for (let c = 0; c < N * N; c++) arr[c] = inRange(s, p, c % N, (c / N) | 0);
    rangeTiles.push(arr);
  }
  const boneIdx = new Array(N * N).fill(-1);
  for (let b = 0; b < s.bones.length; b++) boneIdx[idx(s.bones[b].x, s.bones[b].y)] = b;
  const pass = new Array(N * N);
  for (let c = 0; c < N * N; c++) pass[c] = passable(s, c % N, (c / N) | 0);
  const seen = new Set();
  const outs = new Map();
  const stack = [];
  function dfs(pos, st, bag, dirty, flags, bones) {
    const key = ((((bones * 64 + flags) * 2 + dirty) * 4 + bag) * 11 + st) * 64 + pos;
    if (seen.has(key)) return;
    seen.add(key);
    const px = pos % N, py = (pos / N) | 0;
    if (st - COST_ACT >= dH[pos]) {
      for (let i = 0; i < np; i++) {
        if (!rangeTiles[i][pos] || (needClean[i] && dirty)) continue;
        const fb = 1 << (2 * i), pb = 1 << (2 * i + 1);
        if (allowFeed[i] && bag > 0 && !(flags & fb)) {
          stack.push({ t: 'act', pet: i, type: 'feed' });
          dfs(pos, st - COST_ACT, bag - 1, dirty, flags | fb, bones);
          stack.pop();
        }
        if (allowPet[i] && !(flags & pb)) {
          stack.push({ t: 'act', pet: i, type: 'pet' });
          dfs(pos, st - COST_ACT, bag, dirty, flags | pb, bones);
          stack.pop();
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      const nx = px + DIRS[k][0], ny = py + DIRS[k][1];
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!pass[ni]) continue;
      const nst = st - COST_MOVE;
      if (nst < dH[ni]) continue;
      stack.push({ t: 'move', x: nx, y: ny });
      if (ni === homeI) {
        const ok = flags * 4 + bag;
        const prev = outs.get(ok);
        if (!prev || prev.left < nst) outs.set(ok, { flags: flags, bag: bag, left: nst, steps: stack.slice() });
      } else {
        let nd = dirty, nb = bag, nbones = bones;
        const t = s.tiles[ni];
        if (t === T.MUD) nd = 1; else if (t === T.WATER) nd = 0;
        const b = boneIdx[ni];
        if (b >= 0 && !(nbones & (1 << b)) && nb < BAG_MAX) { nb++; nbones |= 1 << b; }
        dfs(ni, nst, nb, nd, flags, nbones);
      }
      stack.pop();
    }
  }
  dfs(idx(s.player.x, s.player.y), s.stamina, s.bag, s.dirty ? 1 : 0, initFlags, s.bonesTaken);
  return Array.from(outs.values());
}

export function cloneGame(s) {
  const c = Object.assign({}, s);
  c.player = { x: s.player.x, y: s.player.y };
  c.pets = s.pets.map((p) => Object.assign({}, p));
  return c;
}

// 精确求解：按天做广度搜索，返回最少通关天数与“今天”的最优路线
export function solve(s0, maxDays, budgetMs) {
  const t0 = Date.now();
  let frontier = [{ s: cloneGame(s0), first: null }];
  const lastDay = maxDays || s0.maxDays;
  for (let day = s0.day; day <= lastDay; day++) {
    const next = new Map();
    let bestFallback = null;
    for (let f = 0; f < frontier.length; f++) {
      if (budgetMs && Date.now() - t0 > budgetMs) return { days: null, timeout: true, first: frontier[0].first };
      const node = frontier[f];
      const outs = dayOutcomes(node.s);
      for (let o = 0; o < outs.length; o++) {
        const s2 = cloneGame(node.s);
        for (let k = 0; k < outs[o].steps.length; k++) applyStep(s2, outs[o].steps[k]);
        const first = node.first || outs[o].steps;
        if (s2.status === 'won') return { days: s2.day, first: first };
        if (!bestFallback) bestFallback = first;
        nightAdvance(s2, false);
        if (s2.status === 'lost') continue;
        let key = s2.bag + ':' + s2.startIdx;
        for (let i = 0; i < s2.pets.length; i++) key += ':' + Math.min(s2.pets[i].aff, s2.pets[i].target + 2);
        if (!next.has(key)) next.set(key, { s: s2, first: first });
      }
    }
    // 支配剪枝：好感全部不高于、背包不多于另一个状态的，丢掉
    const arr = Array.from(next.values());
    const keep = [];
    for (let i = 0; i < arr.length; i++) {
      let dominated = false;
      for (let j = 0; j < arr.length && !dominated; j++) {
        if (i === j) continue;
        const a = arr[i].s, b = arr[j].s;
        if (a.startIdx !== b.startIdx || b.bag < a.bag) continue;
        let ge = true, gt = b.bag > a.bag;
        for (let k = 0; k < a.pets.length; k++) {
          if (b.pets[k].aff < a.pets[k].aff) { ge = false; break; }
          if (b.pets[k].aff > a.pets[k].aff) gt = true;
        }
        if (ge && (gt || j < i)) dominated = true;
      }
      if (!dominated) keep.push(arr[i]);
    }
    frontier = keep;
    if (!frontier.length) return { days: null, first: bestFallback };
  }
  return { days: null, first: frontier.length ? frontier[0].first : null };
}

export function applyStep(s, st) {
  if (st.t === 'move') return stepTo(s, st.x, st.y);
  return doAction(s, st.pet, st.type);
}

// 贪心模拟整关（每天用求解器的最优方案），返回通关天数；用于校验关卡
export function simulate(def, dayCap) {
  const d = Object.assign({}, def, { maxDays: dayCap || 15 });
  const s = createGame(d);
  for (let guard = 0; guard < 40; guard++) {
    const plan = planDay(s);
    if (!plan) return { days: null, reason: 'noplan', day: s.day };
    for (let i = 0; i < plan.steps.length; i++) applyStep(s, plan.steps[i]);
    if (s.status === 'won') return { days: s.day };
    if (s.status !== 'arrived') return { days: null, reason: s.status, day: s.day };
    nightAdvance(s, false);
    if (s.status === 'lost') return { days: null, reason: 'lost', day: s.day };
  }
  return { days: null, reason: 'guard' };
}
