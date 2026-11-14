// 存档：星级、每日挑战打卡、羁绊、设置
import P from './platform.js';
import { LEVELS, todayKey } from './levels.js';

const KEY = 'bcsh_save_v1';

function fresh() {
  return { stars: {}, medals: {}, hardcore: false, seen: {}, daily: { last: null, streak: 0, cleared: {} } };
}

let D = Object.assign(fresh(), P.storageGet(KEY) || {});
function persist() { P.storageSet(KEY, D); }

export const CH2_NEED = 5; // 第二章解锁所需星星

export const BOND_STEPS = [0, 3, 8, 14];
export const QUOTES = {
  shiba: ['哼，别以为一根骨头就能收买我。', '……今天的摸摸，勉强及格吧。', '你、你明天还会来的吧？不是我想你哦！', '笨蛋铲屎官，这辈子就赖着你了。'],
  collie: ['我在思考狗生，请勿打扰。', '你今天比昨天多陪了我 3 分钟。我算过。', '我把最喜欢的球藏在你鞋子里了。', '一天不见你，我就会掉好感——这是对你的考验。'],
  poodle: ['离我一格远。不，两格。', '你今天……洗过手了吧？', '允许你帮我梳一次毛，就一次。', '就算你一身泥，我也……算了，先去洗澡！'],
};

const Save = {
  stars(id) { return D.stars[id] || 0; },
  medal(id) { return !!D.medals[id]; },
  record(id, stars, hardcore) {
    if (stars > (D.stars[id] || 0)) D.stars[id] = stars;
    if (hardcore) D.medals[id] = true;
    persist();
  },
  totalStars() { let n = 0; for (const k in D.stars) n += D.stars[k]; return n; },
  chapterStars(ch) {
    let n = 0;
    for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].chapter === ch) n += this.stars(LEVELS[i].id);
    return n;
  },
  unlocked(i) {
    const L = LEVELS[i];
    if (i === 0) return true;
    if (L.chapter === 2 && this.chapterStars(1) < CH2_NEED) return false;
    return this.stars(LEVELS[i - 1].id) > 0;
  },
  get hardcore() { return !!D.hardcore; },
  setHardcore(v) { D.hardcore = !!v; persist(); },
  seen(k) { return !!D.seen[k]; },
  markSeen(k) { D.seen[k] = 1; persist(); },
  dailyDone(key) { return !!D.daily.cleared[key || todayKey()]; },
  dailyBest(key) { return D.daily.cleared[key || todayKey()] || 0; },
  streak() {
    const t = todayKey();
    const y = todayKey(new Date(Date.now() - 86400000));
    if (D.daily.last === t || D.daily.last === y) return D.daily.streak;
    return 0;
  },
  recordDaily(days) {
    const t = todayKey();
    const y = todayKey(new Date(Date.now() - 86400000));
    const prev = D.daily.cleared[t];
    if (!prev || days < prev) D.daily.cleared[t] = days;
    if (D.daily.last !== t) {
      D.daily.streak = D.daily.last === y ? D.daily.streak + 1 : 1;
      D.daily.last = t;
    }
    persist();
  },
  dailyCount() { return Object.keys(D.daily.cleared).length; },
  bondPoints(kind) {
    let n = 0;
    for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].pets[kind]) n += this.stars(LEVELS[i].id);
    return n + this.dailyCount() * 2;
  },
  bondLevel(kind) {
    const p = this.bondPoints(kind);
    let lv = 0;
    for (let i = 0; i < BOND_STEPS.length; i++) if (p >= BOND_STEPS[i]) lv = i;
    return lv; // 0..3
  },
  reset() { D = fresh(); persist(); },
};

export default Save;
