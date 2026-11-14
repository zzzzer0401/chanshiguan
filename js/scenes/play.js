// 对局场景
import P from '../platform.js';
import IMG, { petImg } from '../assets.js';
import { C, Ease, clamp, lerp, fillRR, strokeRR, panel, text, textBlock, measure, drawSprite, drawIcon, wrapLines } from '../engine.js';
import * as R from '../rules.js';
import Save from '../save.js';
import { LEVELS, nextLevel } from '../levels.js';
import { bubble, starsRow, heartBar, backButton, chip, modal, pawPrint, moon } from '../ui.js';
import nav from '../nav.js';

const LINES = {
  roast: {
    shiba: ['连家都回不去？哼！', '就这？还想当我的铲屎官？', '体力都算不明白，笨蛋！'],
    collie: ['10 点体力都算不清？我都会算。', '建议回炉重修《回家导论》。', '……我对你很失望。'],
    poodle: ['在外面过夜？脏死了！', '连家都回不去，离我远点。', '铲屎官怎么能睡草地上！'],
  },
  happy: {
    shiba: ['哼…还、还行吧♡', '下次也要这样哦！', '才没有很开心呢！'],
    collie: ['嗯，可以。', '……再来一次也不是不行。', '效率不错。'],
    poodle: ['干干净净的，喜欢～', '手法还算专业。', '允许你多待一会儿。'],
  },
  mismatch: ['才、才不稀罕这个！', '不是这个啦笨蛋！', '哼，猜错了吧～'],
  sulk: ['哼！今天谁也别理我！', '本柴今天闭关！'],
  dirty: ['脏死了！先去洗洗！', '你身上有泥！走开！'],
};
const REASON = {
  far: '太远了，要在 2 格以内', adjacent: '要上下左右紧挨着才行', nobone: '背包里没有零食', done: '今天已经做过啦', tired: '体力不够了',
};
const MOOD_LABEL = { feed: '想吃零食', pet: '想要摸摸', sulk: '哼！闹别扭', hidden: '心情：？' };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default class PlayScene {
  constructor(app, def) {
    this.app = app;
    this.def = def;
    this.daily = !!def.daily;
    this.reset();
  }

  reset() {
    this.g = R.createGame(this.def);
    this.hardcore = Save.hardcore;
    this.sel = this.g.pets.length === 1 ? 0 : -1;
    this.history = [];
    this.undoLeft = this.def.tutorial ? 99 : 3;
    this.hintLeft = 2;
    this.retryLeft = 1;
    this.strands = 0;
    this.hint = null;
    this.anim = null;
    this.fx = [];
    this.bubbles = [];
    this.faces = this.g.pets.map(() => ({ face: 0, until: 0 }));
    this.playerFace = { face: 0, until: 0 };
    this.modal = null;
    this.pending = null;
    this.pendingAct = null;
    this.shake = 0;
    this.time = 0;
    this.banner = null;
    this.playerPos = { x: this.g.player.x, y: this.g.player.y, hop: 0 };
    this.onStateChanged();
    const tips = this.def.tips || [];
    if (tips.length && !Save.seen('tips_' + this.def.id)) this.modal = { type: 'tips', t: 0, i: 0 };
    else this.morningBanner();
  }

  enter() {}

  // ---------------- 布局 ----------------
  layout() {
    const W = P.W, H = P.H;
    const top = P.capsule ? P.capsule.top : P.safeTop;
    const headerH = P.capsule ? Math.max(34, P.capsule.height) : 34;
    const L = {};
    L.header = { y: top, h: headerH, right: P.capsule ? P.capsule.left - 8 : W - 10 };
    L.cardY = top + headerH + 8;
    L.cardH = this.g.pets.length >= 3 ? 72 : 66;
    const toolH = 44;
    const statusH = 30;
    L.toolH = toolH;
    L.panelH = 118;
    const bottom = H - Math.max(10, P.safeBottom + 6);
    const availBoard = bottom - L.cardY - L.cardH - 10 - 8 - statusH - 8 - L.panelH - 10 - toolH;
    const size = Math.min(W - 20, availBoard);
    const ts = Math.floor((size - 12) / 8);
    L.ts = ts;
    L.boardW = ts * 8 + 12;
    let spare = Math.max(0, availBoard - L.boardW);
    const gc = Math.min(12, spare * 0.25); L.cardH += gc; spare -= gc;
    const gp = Math.min(22, spare * 0.35); L.panelH += gp; spare -= gp;
    L.bx = Math.round((W - L.boardW) / 2);
    L.by = Math.round(L.cardY + L.cardH + 10 + spare * 0.4);
    L.statusY = L.by + L.boardW + 8 + spare * 0.15;
    L.panelY = L.statusY + statusH + 8;
    L.toolY = L.panelY + L.panelH + 10;
    L.ox = L.bx + 6; L.oy = L.by + 6;
    this.L = L;
    return L;
  }
  tileCenter(x, y) { const L = this.L; return { x: L.ox + (x + 0.5) * L.ts, y: L.oy + (y + 0.5) * L.ts }; }

  // ---------------- 状态 ----------------
  onStateChanged() {
    if (this.g.status === 'play') this.reach = R.reachMap(this.g);
  }
  pushHistory() { this.history.push(R.snapshot(this.g)); }

  say(who, str, dur, delay) {
    this.bubbles = this.bubbles.filter((b) => b.who !== who);
    this.bubbles.push({ who: who, text: str, t: -(delay || 0), dur: dur || 2.2 });
  }
  setFace(i, face, dur) { this.faces[i] = { face: face, until: this.time + (dur || 1.6) }; }
  firstTip(key, msg) {
    if (Save.seen('tip_' + key)) return;
    Save.markSeen('tip_' + key);
    this.app.toast(msg, C.ink, 3.6);
  }
  houseName(i) { return i === 0 ? '红顶小屋' : '蓝顶小屋'; }
  morningBanner() {
    const g = this.g;
    this.banner = { t: 0, title: '第 ' + g.day + ' 天', sub: '从' + this.houseName(g.startIdx) + '出发 → 回到' + this.houseName(1 - g.startIdx) };
  }

  fxText(tx, ty, str, color, icon) {
    const c = this.tileCenter(tx, ty);
    this.fx.push({ k: 'text', x: c.x, y: c.y - this.L.ts * 0.6, str: str, color: color || C.pinkDeep, icon: icon, t: 0, dur: 1.3 });
  }
  burstHearts(tx, ty, n) {
    const c = this.tileCenter(tx, ty);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 60 + Math.random() * 70;
      this.fx.push({ k: 'heart', x: c.x, y: c.y - this.L.ts * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: 0.9 + Math.random() * 0.4, s: 10 + Math.random() * 8 });
    }
  }
  confetti() {
    const cols = [C.pink, C.yellow, C.mint, C.sky, C.orange];
    for (let i = 0; i < 70; i++) {
      this.fx.push({ k: 'conf', x: Math.random() * P.W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, t: 0, dur: 4, c: cols[i % cols.length], s: 5 + Math.random() * 5 });
    }
  }

  // ---------------- 操作 ----------------
  onTap(x, y) {
    if (this.modal || this.anim) return;
    const L = this.L, g = this.g;
    if (g.status !== 'play') return;
    const tx = Math.floor((x - L.ox) / L.ts), ty = Math.floor((y - L.oy) / L.ts);
    if (!R.inBounds(tx, ty)) return;
    this.tapTile(tx, ty);
  }

  tapTile(tx, ty) {
    const g = this.g;
    const pi = R.petAt(g, tx, ty);
    if (pi >= 0) {
      this.sel = this.sel === pi && g.pets.length > 1 ? -1 : pi;
      return;
    }
    if (tx === g.player.x && ty === g.player.y) return;
    const r = this.reach[ty * 8 + tx];
    if (!r.reach) {
      const t = R.tileAt(g, tx, ty);
      if (t === R.T.BUSH || t === R.T.FENCE || t === R.T.FLOWER) this.app.toast('那里过不去哦');
      else if (r.d === Infinity) this.app.toast('走不到那里');
      else this.app.toast('体力不够走到那里（需要 ' + r.d + '）');
      return;
    }
    if (!r.safe && !this.hardcore) {
      const p = this.pending;
      if (!(p && p.x === tx && p.y === ty && this.time - p.t < 4)) {
        this.pending = { x: tx, y: ty, t: this.time };
        this.app.toast('⚠️ 去那里就回不了家了！再点一次确认', C.red);
        this.firstTip('danger', '红色格子 = 走过去就没体力回家了，会触发「回巢失败」。');
        return;
      }
    }
    this.pending = null;
    const path = R.findPath(g, tx, ty);
    if (!path) return;
    this.pushHistory();
    this.anim = { path: path, i: 0, t: 0, start: { x: g.player.x, y: g.player.y } };
  }

  act(pi, type) {
    if (this.modal || this.anim) return;
    const g = this.g;
    const info = R.actionInfo(g, pi, type);
    if (!info.ok) { this.app.toast(REASON[info.reason] || '现在不行'); return; }
    if (info.strand && !this.hardcore) {
      const p = this.pendingAct;
      if (!(p && p.pi === pi && p.type === type && this.time - p.t < 4)) {
        this.pendingAct = { pi: pi, type: type, t: this.time };
        this.app.toast('⚠️ 做完这个就没体力回家了！再点一次确认', C.red);
        return;
      }
    }
    this.pendingAct = null;
    this.pushHistory();
    const ev = R.doAction(g, pi, type);
    const pet = g.pets[pi];
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.t !== 'gain') continue;
      if (e.gain > 0) {
        this.setFace(pi, 1, 1.8);
        this.burstHearts(pet.x, pet.y, 7);
        this.fxText(pet.x, pet.y, '+' + e.gain, C.pinkDeep, IMG.ic_heart);
        this.say(pi, pick(LINES.happy[pet.kind]), 1.8);
        P.vibrate(false);
        if (pet.aff >= pet.target && pet.aff - e.gain < pet.target) this.app.toast(R.PET_DEFS[pet.kind].name + ' 的好感达标啦！', C.mintDeep);
      } else {
        const lines = e.reason === 'dirty' ? LINES.dirty : e.reason === 'sulk' ? LINES.sulk : LINES.mismatch;
        this.setFace(pi, e.reason === 'dirty' ? 2 : 3, 2);
        this.fxText(pet.x, pet.y, '+0', '#9A8F86', IMG.ic_broken);
        this.say(pi, pick(lines), 2);
        this.firstTip('zero_' + e.reason, e.reason === 'dirty' ? '棉花糖嫌你脏！先去水洼洗干净再来。' : '柴犬傲娇：不合心意的互动 +0，白花 2 点体力。看清它头顶的心情！');
      }
    }
    this.consumeHint({ t: 'act', pet: pi, type: type });
    this.afterOp();
    this.handleEvents(ev);
  }

  afterOp() {
    this.onStateChanged();
  }

  handleEvents(ev) {
    const g = this.g;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.t === 'dirty') {
        this.say('player', '呜…踩到泥了', 1.6);
        for (let k = 0; k < g.pets.length; k++) if (g.pets[k].kind === 'poodle') { this.say(k, '咦！你身上有泥！', 1.8, 0.3); this.setFace(k, 3, 2); }
        this.firstTip('dirty', '身上有泥：贵宾犬会拒绝一切互动。踩水洼能洗干净，第二天也会自动洗干净。');
      } else if (e.t === 'clean') {
        this.fxText(g.player.x, g.player.y, '洗干净啦', C.blue);
      } else if (e.t === 'bone') {
        this.fxText(g.player.x, g.player.y, '+1', '#C08A4A', IMG.bone);
        this.firstTip('bone', '捡到零食！喂食会消耗 1 个，最多带 3 个，棋盘上的零食每天刷新。');
      } else if (e.t === 'bagfull') {
        this.app.toast('背包满了（最多 3 个零食）');
      } else if (e.t === 'reveal') {
        this.say(e.pet, '今天嘛…' + (e.mood === 'feed' ? '想吃零食！' : e.mood === 'pet' ? '想要摸摸！' : '哼！'), 2.4);
      } else if (e.t === 'won') {
        this.onWin();
      } else if (e.t === 'arrived') {
        this.onArrive();
      } else if (e.t === 'stranded') {
        this.onStrand();
      }
    }
  }

  undo() {
    if (this.anim || this.modal) return;
    if (this.g.status !== 'play') return;
    if (!this.history.length) { this.app.toast('今天还没有可以撤销的操作'); return; }
    if (this.undoLeft <= 0) { this.app.toast('撤销次数用完了（正式版：看视频 +3 次）'); return; }
    R.restore(this.g, this.history.pop());
    this.undoLeft--;
    this.playerPos = { x: this.g.player.x, y: this.g.player.y, hop: 0 };
    this.hint = null;
    this.onStateChanged();
  }

  useHint() {
    if (this.anim || this.modal || this.g.status !== 'play') return;
    if (this.hint) { this.hint = null; return; }
    if (this.hintLeft <= 0) { this.app.toast('提示用完了（正式版：看视频获得）'); return; }
    const t0 = Date.now();
    let res = R.solve(this.g, this.g.maxDays, 700);
    let steps = res && res.first;
    if (!steps) { const p = R.planDay(this.g); steps = p ? p.steps : null; }
    if (!steps) { this.app.toast('今天已经没有好的走法了，先回家吧'); return; }
    this.hintLeft--;
    this.hint = steps.slice();
    if (res && res.days) this.app.toast('最优解：第 ' + res.days + ' 天可以通关。按脚印走～', C.ink, 2.6);
    else this.app.toast('按脚印走，今天收益最高～');
    void t0;
  }

  // 提示路线跟随：玩家按提示走时逐步消耗
  consumeHint(step) {
    if (!this.hint || !this.hint.length) return;
    const h = this.hint[0];
    if (h.t === step.t && ((h.t === 'move' && h.x === step.x && h.y === step.y) || (h.t === 'act' && h.pet === step.pet && h.type === step.type))) this.hint.shift();
    else this.hint = null;
  }

  onArrive() {
    this.playerFace = { face: 0, until: 0 };
    this.say('player', '到家啦～', 1.2);
    const self = this;
    this.modal = { type: 'wait', t: 0, dur: 0.7, then: () => self.startNight(false) };
  }

  startNight(failed) {
    const g = this.g;
    const prevDay = g.day;
    const report = R.nightAdvance(g, failed);
    this.history = [];
    this.hint = null;
    this.pending = null;
    this.anim = null;
    this.bubbles = [];
    this.faces = g.pets.map(() => ({ face: 0, until: 0 }));
    this.playerFace = { face: 0, until: 0 };
    this.playerPos = { x: g.player.x, y: g.player.y, hop: 0 };
    this.modal = { type: 'night', t: 0, report: report, failed: failed, day: prevDay };
    this.onStateChanged();
  }

  onStrand() {
    const g = this.g;
    this.strands++;
    this.shake = 0.45;
    P.vibrate(true);
    this.playerFace = { face: 2, until: 1e9 };
    for (let i = 0; i < g.pets.length; i++) {
      this.faces[i] = { face: 2, until: 1e9 };
      this.say(i, pick(LINES.roast[g.pets[i].kind]), 3, 0.25 + i * 0.35);
    }
    this.say('player', '体力…不够回家了…', 2.5);
    this.modal = { type: 'fail', t: 0, roast: pick(LINES.roast[g.pets[Math.floor(Math.random() * g.pets.length)].kind]) };
    this.firstTip('strand', '回巢失败：当天获得的好感全部清零，当天作废。');
  }

  onWin() {
    const g = this.g;
    const stars = 1 + (this.strands === 0 ? 1 : 0) + (g.day <= this.def.par ? 1 : 0);
    this.result = { stars: stars, day: g.day, strands: this.strands, hard: this.hardcore };
    if (this.daily) Save.recordDaily(g.day);
    else Save.record(this.def.id, stars, this.hardcore && stars === 3);
    for (let i = 0; i < g.pets.length; i++) { this.faces[i] = { face: 1, until: 1e9 }; this.burstHearts(g.pets[i].x, g.pets[i].y, 10); }
    this.playerFace = { face: 1, until: 1e9 };
    this.confetti();
    P.vibrate(false);
    this.modal = { type: 'win', t: 0 };
  }

  restartDay() {
    const g = this.g;
    R.restore(g, g.morning);
    g.status = 'play';
    this.retryLeft--;
    this.history = [];
    this.hint = null;
    this.bubbles = [];
    this.faces = g.pets.map(() => ({ face: 0, until: 0 }));
    this.playerFace = { face: 0, until: 0 };
    this.playerPos = { x: g.player.x, y: g.player.y, hop: 0 };
    this.modal = null;
    this.onStateChanged();
    this.banner = { t: 0, title: '重来一次', sub: '这次算准点：回家需要的体力要留够！' };
  }

  shareRoast() {
    const kind = this.g.pets[0].kind;
    const name = R.PET_DEFS[kind].breed;
    const title = '我家' + name + '说我“连家都回不去”……你来试试？';
    if (!P.share(title, 'level=' + this.def.id)) this.app.toast('（演示）在微信里会拉起分享：「' + title + '」', C.ink, 3);
  }

  // ---------------- 更新 ----------------
  update(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake -= dt;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2.4) this.banner = null; }
    if (this.modal) {
      this.modal.t += dt;
      if (this.modal.type === 'wait' && this.modal.t >= this.modal.dur) { const f = this.modal.then; this.modal = null; f(); }
    }
    const a = this.anim;
    if (a) {
      a.t += dt / 0.14;
      if (a.t >= 1) {
        const step = a.path[a.i];
        const ev = R.stepTo(this.g, step.x, step.y);
        this.consumeHint({ t: 'move', x: step.x, y: step.y });
        this.playerPos = { x: step.x, y: step.y, hop: 0 };
        a.i++; a.t = 0;
        if (a.i >= a.path.length || this.g.status !== 'play') {
          this.anim = null;
          this.onStateChanged();
        }
        this.handleEvents(ev);
      } else {
        const from = a.i === 0 ? a.start : a.path[a.i - 1];
        const to = a.path[a.i];
        this.playerPos = { x: lerp(from.x, to.x, a.t), y: lerp(from.y, to.y, a.t), hop: Math.sin(a.t * Math.PI), flip: to.x < from.x };
      }
    }
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      f.t += dt;
      if (f.k === 'heart') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt; }
      else if (f.k === 'conf') { f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
      else if (f.k === 'text') f.y -= 28 * dt;
    }
    this.fx = this.fx.filter((f) => f.t < f.dur);
    for (let i = 0; i < this.bubbles.length; i++) this.bubbles[i].t += dt;
    this.bubbles = this.bubbles.filter((b) => b.t < b.dur);
  }

  petFace(i) {
    const f = this.faces[i];
    if (f && f.until > this.time) return f.face;
    const g = this.g, p = g.pets[i];
    if (p.kind === 'shiba' && R.visibleMood(g, p) === 'sulk') return 3;
    if (p.kind === 'poodle' && g.dirty && Math.abs(p.x - g.player.x) + Math.abs(p.y - g.player.y) <= 2) return 3;
    if (p.aff >= p.target) return 1;
    return 0;
  }

  // ---------------- 绘制 ----------------
  draw(ctx) {
    const L = this.layout();
    this.app.toastY = L.panelY + 8;
    const W = P.W, H = P.H;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#FFF1DC'); grd.addColorStop(1, '#FFE6EC');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    this.drawHeader(ctx, L);
    this.drawCards(ctx, L);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 6 * this.shake);
    this.drawBoard(ctx, L);
    ctx.restore();
    this.drawStatus(ctx, L);
    this.drawPanel(ctx, L);
    this.drawTools(ctx, L);
    this.drawFx(ctx);
    if (this.banner) this.drawBanner(ctx, L);
    if (this.modal) this.drawModal(ctx, L);
    this.drawConfetti(ctx);
  }

  drawHeader(ctx, L) {
    const app = this.app, g = this.g;
    const y = L.header.y + (L.header.h - 34) / 2;
    backButton(app, ctx, 10, y, () => { if (!this.modal) this.modal = { type: 'quit', t: 0 }; });
    const title = this.daily ? '每日挑战' : this.def.id + ' ' + this.def.name;
    text(ctx, title, 52, y + 17, { size: 16, align: 'left' });
    const dayStr = '第 ' + Math.min(g.day, g.maxDays) + '/' + g.maxDays + ' 天';
    const lastDay = g.day >= g.maxDays;
    chip(ctx, dayStr, L.header.right, y + 4, { align: 'right', bg: lastDay ? '#FFE0DE' : '#FFFFFF', color: lastDay ? C.red : C.ink, size: 13 });
  }

  drawCards(ctx, L) {
    const g = this.g, app = this.app;
    const n = g.pets.length;
    const gap = 6;
    let cw = (P.W - 20 - gap * (n - 1)) / n;
    cw = Math.min(cw, 220);
    const total = cw * n + gap * (n - 1);
    let x = (P.W - total) / 2;
    const y = L.cardY, h = L.cardH;
    for (let i = 0; i < n; i++) {
      const p = g.pets[i];
      const def = R.PET_DEFS[p.kind];
      const sel = this.sel === i;
      const met = p.aff >= p.target;
      panel(ctx, x, y, cw, h, 14, sel ? '#FFFFFF' : 'rgba(255,255,255,0.85)', sel ? def.color : 'rgba(91,58,41,0.15)', sel ? 3 : 2);
      if (sel) strokeRR(ctx, x, y, cw, h, 14, def.color, 2.5);
      const av = Math.min(h - 12, cw * 0.4);
      const aw = av * 0.86;
      drawSprite(ctx, petImg(p.kind, this.petFace(i)), x + 5 + aw / 2, y + h - 6, av);
      const tx = x + 9 + aw;
      const tw = x + cw - 8 - tx;
      text(ctx, def.name, tx, y + 14, { size: 13, align: 'left' });
      const nw = measure(ctx, def.name, 13);
      if (tw - nw > 34) {
        fillRR(ctx, tx + nw + 4, y + 6, 30, 16, 8, def.color);
        text(ctx, def.trait, tx + nw + 19, y + 14.5, { size: 10, color: '#FFFFFF' });
      }
      heartBar(ctx, tx, y + 26, tw, 8, p.aff, p.target, met ? C.mint : C.pink);
      drawIcon(ctx, IMG.ic_heart, tx, y + 30, 12);
      // 状态小字
      let st = '', sc = C.inkSoft;
      if (p.kind === 'shiba' && p.moods) {
        const m = R.visibleMood(g, p);
        st = m === 'feed' ? '想吃🦴' : m === 'pet' ? '想摸✋' : m === 'sulk' ? '哼！' : '心情？';
        sc = m === 'sulk' ? C.red : C.orange;
      } else if (p.kind === 'collie') { st = p.touched ? '今晚-1' : '今晚-2'; sc = p.touched ? C.inkSoft : C.red; }
      else if (p.kind === 'poodle') { st = g.dirty ? '嫌你脏' : '干净✓'; sc = g.dirty ? C.red : C.mintDeep; }
      const affStr = p.aff + '/' + p.target + (met ? '✓' : '');
      const wide = tw > 96;
      text(ctx, affStr, tx, y + 46, { size: 12, align: 'left', color: met ? C.mintDeep : C.ink });
      if (wide) text(ctx, st, x + cw - 8, y + 46, { size: 11, align: 'right', color: sc });
      else text(ctx, st, tx, y + Math.max(61, h - 11), { size: 11, align: 'left', color: sc });
      const ii = i;
      app.hit(x, y, cw, h, () => { if (!this.modal) this.sel = this.sel === ii && n > 1 ? -1 : ii; });
      x += cw + gap;
    }
  }

  drawBoard(ctx, L) {
    const g = this.g, ts = L.ts;
    // 木框
    panel(ctx, L.bx, L.by, L.boardW, L.boardW, 16, '#E9B97F', '#B07A45', 6);
    fillRR(ctx, L.ox - 1, L.oy - 1, ts * 8 + 2, ts * 8 + 2, 10, '#9FCC7E');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const px = L.ox + x * ts, py = L.oy + y * ts;
        const r = (x === 0 && y === 0) || (x === 7 && y === 0) || (x === 0 && y === 7) || (x === 7 && y === 7) ? 8 : 3;
        fillRR(ctx, px + 1, py + 1, ts - 2, ts - 2, r, (x + y) % 2 ? C.grassB : C.grassA);
      }
    }
    // 地面贴花：泥坑、水洼
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const t = R.tileAt(g, x, y);
      const c = this.tileCenter(x, y);
      if (t === R.T.MUD) drawIcon(ctx, IMG.mud, c.x, c.y + 2, ts * 0.92);
      else if (t === R.T.WATER) drawIcon(ctx, IMG.water, c.x, c.y + 2, ts * 0.92);
    }
    const home = R.homeOf(g);
    const playing = g.status === 'play' && !this.modal && !this.anim;
    // 可达/危险提示
    if (playing && this.reach && !this.hardcore) {
      for (let i = 0; i < 64; i++) {
        const r = this.reach[i];
        if (!r.reach) continue;
        const x = i % 8, y = (i / 8) | 0;
        if (x === home.x && y === home.y) continue;
        const c = this.tileCenter(x, y);
        if (r.safe) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath(); ctx.arc(c.x, c.y, ts * 0.09, 0, Math.PI * 2); ctx.fill();
        } else {
          fillRR(ctx, L.ox + x * ts + 2, L.oy + y * ts + 2, ts - 4, ts - 4, 6, 'rgba(240,84,84,0.2)');
          strokeRR(ctx, L.ox + x * ts + 4, L.oy + y * ts + 4, ts - 8, ts - 8, 5, 'rgba(226,70,70,0.55)', 1.5);
        }
      }
    }
    // 选中狗狗的互动范围
    if (this.sel >= 0 && playing) {
      const p = g.pets[this.sel];
      const col = R.PET_DEFS[p.kind].color;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(this.time * 4);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if ((x !== p.x || y !== p.y) && R.inRange(g, p, x, y) && R.passable(g, x, y)) strokeRR(ctx, L.ox + x * ts + 4, L.oy + y * ts + 4, ts - 8, ts - 8, 7, col, 2.5);
      }
      ctx.restore();
    }
    // 散步预告
    for (let i = 0; i < g.pets.length; i++) {
      const np = R.nextPos(g.pets[i]);
      if (!np) continue;
      const a = this.tileCenter(g.pets[i].x, g.pets[i].y), b = this.tileCenter(np.x, np.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(93,107,138,0.45)'; ctx.lineWidth = 2;
      if (ctx.setLineDash) ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      pawPrint(ctx, b.x, b.y, ts * 0.5, R.PET_DEFS[g.pets[i].kind].color, 0.55);
      text(ctx, '明天', b.x, b.y + ts * 0.36, { size: 9, color: '#FFFFFF', stroke: 'rgba(93,107,138,0.8)', strokeWidth: 3 });
    }
    // 提示路线
    if (this.hint && playing) this.drawHint(ctx, L);
    // 目标小屋光圈
    {
      const c = this.tileCenter(home.x, home.y);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.fillStyle = '#FFF4B0';
      ctx.beginPath(); ctx.arc(c.x, c.y + ts * 0.15, ts * (0.48 + 0.06 * pulse), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 实体（按行排序绘制）
    const ents = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const t = R.tileAt(g, x, y);
      if (t === R.T.BUSH || t === R.T.FENCE || t === R.T.FLOWER) ents.push({ y: y, k: 'obs', x: x, t: t });
    }
    for (let b = 0; b < g.bones.length; b++) if (R.boneVisible(g, b)) ents.push({ y: g.bones[b].y - 0.01, k: 'bone', x: g.bones[b].x, b: b });
    ents.push({ y: g.houses[0].y, k: 'house', i: 0 });
    ents.push({ y: g.houses[1].y, k: 'house', i: 1 });
    for (let i = 0; i < g.pets.length; i++) ents.push({ y: g.pets[i].y + 0.01, k: 'pet', i: i });
    ents.push({ y: this.playerPos.y + 0.02, k: 'player' });
    ents.sort((a, b) => a.y - b.y);
    for (let e = 0; e < ents.length; e++) {
      const en = ents[e];
      if (en.k === 'obs') {
        const c = this.tileCenter(en.x, en.y);
        const img = en.t === R.T.BUSH ? IMG.bush : en.t === R.T.FENCE ? IMG.fence : IMG.flower;
        this.shadow(ctx, c.x, c.y + ts * 0.36, ts * 0.38);
        drawSprite(ctx, img, c.x, c.y + ts * 0.44, ts * (en.t === R.T.FENCE ? 0.7 : 0.86));
      } else if (en.k === 'bone') {
        const c = this.tileCenter(en.x, Math.round(en.y + 0.01));
        const bob = Math.sin(this.time * 3 + en.b) * 2;
        this.shadow(ctx, c.x, c.y + ts * 0.25, ts * 0.22);
        drawIcon(ctx, IMG.bone, c.x, c.y + bob, ts * 0.6, { rot: -0.25 });
      } else if (en.k === 'house') {
        const hs = g.houses[en.i];
        const c = this.tileCenter(hs.x, hs.y);
        const isHome = hs.x === home.x && hs.y === home.y;
        drawSprite(ctx, en.i === 0 ? IMG.house_a : IMG.house_b, c.x, c.y + ts * 0.48, ts * 1.12, { alpha: isHome ? 1 : 0.8 });
        if (isHome && g.status === 'play') {
          const by = c.y - ts * 0.75 + Math.sin(this.time * 5) * 3;
          fillRR(ctx, c.x - 19, by - 10, 38, 18, 9, C.red);
          text(ctx, '回家', c.x, by - 0.5, { size: 11, color: '#FFFFFF' });
          ctx.fillStyle = C.red;
          ctx.beginPath(); ctx.moveTo(c.x - 5, by + 7); ctx.lineTo(c.x, by + 12); ctx.lineTo(c.x + 5, by + 7); ctx.fill();
        }
      } else if (en.k === 'pet') {
        this.drawPet(ctx, L, en.i);
      } else if (en.k === 'player') {
        this.drawPlayer(ctx, L);
      }
    }
    // 气泡
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      if (b.t < 0) continue;
      let c;
      if (b.who === 'player') c = this.tileCenter(this.playerPos.x, this.playerPos.y);
      else { const p = g.pets[b.who]; if (!p) continue; c = this.tileCenter(p.x, p.y); }
      const a = b.t < 0.15 ? b.t / 0.15 : b.t > b.dur - 0.25 ? (b.dur - b.t) / 0.25 : 1;
      bubble(ctx, b.text, c.x, c.y - ts * 0.75, { size: 12, maxW: 130, alpha: a, minX: L.bx + 2, maxX: L.bx + L.boardW - 2 });
    }
  }

  shadow(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.35);
    ctx.fillStyle = 'rgba(60,90,40,0.22)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawPet(ctx, L, i) {
    const g = this.g, ts = L.ts;
    const p = g.pets[i];
    const c = this.tileCenter(p.x, p.y);
    const face = this.petFace(i);
    let bob = Math.sin(this.time * 3 + i * 1.7) * 1.2;
    if (face === 1) bob -= Math.abs(Math.sin(this.time * 9)) * 4;
    const sel = this.sel === i;
    if (sel) bob -= Math.abs(Math.sin(this.time * 5)) * 3;
    this.shadow(ctx, c.x, c.y + ts * 0.38, ts * 0.34);
    drawSprite(ctx, petImg(p.kind, face), c.x, c.y + ts * 0.46 + bob, ts * 1.08);
    if (sel) {
      const ay = c.y - ts * 0.72 + Math.sin(this.time * 6) * 2;
      ctx.fillStyle = R.PET_DEFS[p.kind].color;
      ctx.beginPath(); ctx.moveTo(c.x - 6, ay - 6); ctx.lineTo(c.x + 6, ay - 6); ctx.lineTo(c.x, ay + 2); ctx.fill();
    }
    // 柴犬心情泡泡
    if (p.kind === 'shiba' && p.moods && g.status !== 'won') {
      const m = R.visibleMood(g, p);
      const bx = c.x + ts * 0.42, by = c.y - ts * 0.42;
      const r = ts * 0.22;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = 'rgba(91,58,41,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - r * 0.9, by + r * 0.9, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (m === 'feed') drawIcon(ctx, IMG.bone, bx, by, r * 1.5, { rot: -0.3 });
      else if (m === 'pet') drawIcon(ctx, IMG.ic_pet, bx, by, r * 1.5);
      else text(ctx, m === 'sulk' ? '哼' : '?', bx, by + 1, { size: Math.round(r * 1.1), color: m === 'sulk' ? C.red : C.orange });
    }
    // 达标小勾
    if (p.aff >= p.target) {
      const bx = c.x - ts * 0.4, by = c.y - ts * 0.38;
      ctx.fillStyle = C.mint;
      ctx.beginPath(); ctx.arc(bx, by, ts * 0.15, 0, Math.PI * 2); ctx.fill();
      text(ctx, '✓', bx, by + 1, { size: Math.round(ts * 0.22), color: '#FFFFFF' });
    }
  }

  drawPlayer(ctx, L) {
    const g = this.g, ts = L.ts;
    const pp = this.playerPos;
    const c = this.tileCenter(pp.x, pp.y);
    let face = 0;
    if (this.playerFace.until > this.time) face = this.playerFace.face;
    else if (g.stamina <= R.homeDistNow(g) && g.status === 'play' && g.stamina > 0 && R.homeDistNow(g) > 0) face = 0;
    const hop = (pp.hop || 0) * ts * 0.22;
    this.shadow(ctx, c.x, c.y + ts * 0.4, ts * 0.26 * (1 - (pp.hop || 0) * 0.3));
    drawSprite(ctx, IMG['player_' + face], c.x, c.y + ts * 0.46 - hop, ts * 1.22, { flip: pp.flip });
    if (g.dirty) {
      ctx.fillStyle = '#8B5A2B';
      const pts = [[-0.12, 0.3], [0.1, 0.36], [0.02, 0.18], [-0.05, 0.42]];
      for (let i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(c.x + pts[i][0] * ts, c.y + pts[i][1] * ts - hop, ts * 0.045, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawHint(ctx, L) {
    const g = this.g, ts = L.ts;
    let pos = { x: g.player.x, y: g.player.y };
    let n = 1;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 5);
    for (let i = 0; i < this.hint.length; i++) {
      const s = this.hint[i];
      if (s.t === 'move') {
        const a = this.tileCenter(pos.x, pos.y), b = this.tileCenter(s.x, s.y);
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#FFD25A'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
        pawPrint(ctx, b.x, b.y, ts * 0.32, '#E0A100', 0.8);
        pos = { x: s.x, y: s.y };
      } else {
        const c = this.tileCenter(pos.x, pos.y);
        const ox = c.x + ts * 0.3, oy = c.y - ts * 0.3 - (n - 1) * ts * 0.36;
        ctx.save(); ctx.globalAlpha = pulse;
        fillRR(ctx, ox - ts * 0.2, oy - ts * 0.2, ts * 0.4, ts * 0.4, ts * 0.12, '#FFFFFF');
        ctx.restore();
        drawIcon(ctx, s.type === 'feed' ? IMG.ic_feed : IMG.ic_pet, ox, oy, ts * 0.34);
        n++;
      }
    }
  }

  drawStatus(ctx, L) {
    const g = this.g;
    const y = L.statusY;
    const x0 = 12;
    drawIcon(ctx, IMG.ic_energy, x0 + 9, y + 13, 22);
    const dH = R.homeDistNow(g);
    const maxS = g.maxStamina;
    const avail = P.W - 24 - 30 - 112;
    const pw = Math.min(16, Math.floor((avail - (maxS - 1) * 3) / maxS));
    let px = x0 + 24;
    const reserve = g.status === 'play' ? Math.min(dH === Infinity ? 0 : dH, g.stamina) : 0;
    for (let i = 0; i < maxS; i++) {
      let col = 'rgba(91,58,41,0.13)';
      if (i < g.stamina - reserve) col = C.yellow;
      else if (i < g.stamina) col = C.orange;
      fillRR(ctx, px, y + 4, pw, 18, 5, col);
      if (i < g.stamina) { ctx.save(); ctx.globalAlpha = 0.5; fillRR(ctx, px + 2, y + 6, pw - 4, 4, 2, '#FFFFFF'); ctx.restore(); }
      px += pw + 3;
    }
    const free = g.stamina - reserve;
    const msg = g.status !== 'play' ? '' : free <= 0 ? '只够回家了！' : '回家需 ' + dH;
    text(ctx, msg, px + 4, y + 13, { size: 12, align: 'left', color: free <= 0 ? C.red : C.orange });
    // 背包与状态
    const rx = P.W - 12;
    const bagStr = '×' + g.bag;
    text(ctx, bagStr, rx, y + 13, { size: 13, align: 'right' });
    drawIcon(ctx, IMG.bone, rx - measure(ctx, bagStr, 13) - 14, y + 13, 24, { rot: -0.3 });
    if (g.dirty) drawIcon(ctx, IMG.mud, rx - measure(ctx, bagStr, 13) - 44, y + 13, 24);
  }

  drawPanel(ctx, L) {
    const g = this.g, app = this.app;
    const x = 10, w = P.W - 20, y = L.panelY, h = L.panelH;
    panel(ctx, x, y, w, h, 18, '#FFFFFF', 'rgba(91,58,41,0.15)', 3);
    if (this.sel < 0 || !g.pets[this.sel]) {
      text(ctx, '今天：' + this.houseName(g.startIdx) + ' → ' + this.houseName(1 - g.startIdx), x + w / 2, y + 26, { size: 15 });
      textBlock(ctx, '点狗狗（或上方卡片）查看互动 · 点格子移动\n白点 = 去了还能回家，红格 = 去了就回不了家', x + w / 2, y + 46, w - 30, { size: 12, color: C.inkSoft, weight: 'normal' });
      const need = g.pets.filter((p) => p.aff < p.target).map((p) => R.PET_DEFS[p.kind].name);
      text(ctx, need.length ? '还差：' + need.join('、') : '全部达标！回家就通关', x + w / 2, y + h - 18, { size: 12, color: need.length ? C.pinkDeep : C.mintDeep });
      return;
    }
    const pi = this.sel;
    const p = g.pets[pi];
    const def = R.PET_DEFS[p.kind];
    drawSprite(ctx, petImg(p.kind, this.petFace(pi)), x + 30, y + 50, 44);
    text(ctx, def.name + ' · ' + def.breed, x + 58, y + 16, { size: 14, align: 'left' });
    const tw = measure(ctx, def.name + ' · ' + def.breed, 14);
    fillRR(ctx, x + 64 + tw, y + 8, 34, 17, 8.5, def.color);
    text(ctx, def.trait, x + 81 + tw, y + 16.5, { size: 11, color: '#FFFFFF' });
    let info = def.rule;
    if (p.kind === 'shiba' && p.moods) {
      const m = R.visibleMood(g, p);
      const tm = p.moods[g.day % p.moods.length];
      const tmv = tm.charAt(0) === '?' ? '？' : MOOD_LABEL[tm];
      info = '今天：' + MOOD_LABEL[m] + '　明天：' + tmv + '\n只吃它想要的那一套，不对就 +0。';
    }
    textBlock(ctx, info, x + 58, y + 26, w - 66, { size: 11, color: C.inkSoft, weight: 'normal', align: 'left', lineHeight: 15 });
    // 两个互动按钮
    const by = y + 60, bh = Math.min(64, h - 70), gap = 8;
    const bw = (w - 20 - gap) / 2;
    const types = ['feed', 'pet'];
    for (let k = 0; k < 2; k++) {
      const type = types[k];
      const info2 = R.actionInfo(g, pi, type);
      const bx = x + 10 + k * (bw + gap);
      const disabled = !info2.ok || g.status !== 'play' || !!this.anim;
      const zero = info2.ok && info2.gain === 0;
      const color = zero ? '#C9BFB6' : k === 0 ? C.orange : C.pink;
      const edge = zero ? '#A99C90' : k === 0 ? '#E08A2E' : C.pinkDeep;
      app.button(ctx, bx, by, bw, bh, '', () => this.act(pi, type), {
        disabled: disabled, color: color, edge: edge, r: 14,
        onDisabled: () => { if (!info2.ok) this.app.toast(REASON[info2.reason] || '现在不行'); },
      });
      const pressed = !disabled && app.isPressed(bx, by, bw, bh) ? 3 : 0;
      drawIcon(ctx, type === 'feed' ? IMG.ic_feed : IMG.ic_pet, bx + 25, by + bh / 2 + pressed, 32, { alpha: disabled ? 0.5 : 1 });
      const tc = disabled ? '#A99C90' : '#FFFFFF';
      text(ctx, type === 'feed' ? '喂食' : '摸摸', bx + 46, by + bh / 2 - 8 + pressed, { size: 16, align: 'left', color: tc });
      let sub;
      if (!info2.ok) sub = info2.reason === 'far' ? '太远了' : info2.reason === 'adjacent' ? '要紧挨着' : info2.reason === 'nobone' ? '没零食' : info2.reason === 'done' ? '今天做过了' : '体力不足';
      else if (info2.gain > 0) sub = '+' + info2.gain + '❤';
      else sub = info2.reason === 'dirty' ? '+0 嫌脏' : info2.reason === 'sulk' ? '+0 哼！' : '+0 不对胃口';
      text(ctx, sub, bx + 46, by + bh / 2 + 10 + pressed, { size: 12, align: 'left', color: tc, weight: info2.ok ? 'bold' : 'normal' });
      fillRR(ctx, bx + bw - 34, by + 6 + pressed, 28, 16, 8, 'rgba(255,255,255,0.55)');
      text(ctx, '⚡2', bx + bw - 20, by + 14.5 + pressed, { size: 10, color: C.ink });
    }
  }

  drawTools(ctx, L) {
    const app = this.app;
    const y = L.toolY;
    const items = [
      { icon: IMG.ic_undo, label: '撤销', n: this.undoLeft > 50 ? '∞' : this.undoLeft, cb: () => this.undo() },
      { icon: IMG.ic_hint, label: this.hint ? '收起' : '提示', n: this.hintLeft, cb: () => this.useHint() },
      { icon: IMG.ic_star, label: '规则', cb: () => { if (!this.modal) this.modal = { type: 'rules', t: 0 }; } },
      { icon: IMG.ic_home, label: '重开', cb: () => { if (!this.modal) this.modal = { type: 'restart', t: 0 }; } },
    ];
    const gap = 8;
    const bw = (P.W - 20 - gap * 3) / 4;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const bx = 10 + i * (bw + gap);
      app.button(ctx, bx, y, bw, 38, '', it.cb, { color: '#FFFFFF', edge: 'rgba(91,58,41,0.2)', r: 12 });
      const pr = app.isPressed(bx, y, bw, 38) ? 3 : 0;
      drawIcon(ctx, it.icon, bx + 20, y + 19 + pr, 22);
      text(ctx, it.label, bx + 34, y + 19 + pr, { size: 13, align: 'left' });
      if (it.n !== undefined) {
        fillRR(ctx, bx + bw - 18, y - 5, 22, 17, 8.5, C.pinkDeep);
        text(ctx, String(it.n), bx + bw - 7, y + 3.5, { size: 10, color: '#FFFFFF' });
      }
    }
  }

  drawFx(ctx) {
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      const a = 1 - f.t / f.dur;
      if (f.k === 'heart') {
        drawIcon(ctx, IMG.ic_heart, f.x, f.y, f.s, { alpha: Math.min(1, a * 1.5) });
      } else if (f.k === 'text') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 2);
        const sc = f.t < 0.15 ? Ease.outBack(f.t / 0.15) : 1;
        ctx.translate(f.x, f.y); ctx.scale(sc, sc);
        const w = measure(ctx, f.str, 18);
        if (f.icon) drawIcon(ctx, f.icon, -w / 2 - 10, 0, 20);
        text(ctx, f.str, f.icon ? 6 : 0, 0, { size: 18, color: f.color, stroke: '#FFFFFF', strokeWidth: 4 });
        ctx.restore();
      }
    }
  }
  drawConfetti(ctx) {
    for (let i = 0; i < this.fx.length; i++) {
      const f = this.fx[i];
      if (f.k !== 'conf') continue;
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      ctx.fillStyle = f.c;
      ctx.fillRect(-f.s / 2, -f.s / 4, f.s, f.s / 2);
      ctx.restore();
    }
  }

  drawBanner(ctx, L) {
    const b = this.banner;
    const a = b.t < 0.25 ? b.t / 0.25 : b.t > 2.0 ? Math.max(0, (2.4 - b.t) / 0.4) : 1;
    const cy = L.by + L.boardW * 0.42;
    ctx.save();
    ctx.globalAlpha = a;
    const w = Math.min(P.W - 40, 300), h = 64;
    const sc = b.t < 0.25 ? Ease.outBack(b.t / 0.25) : 1;
    ctx.translate(P.W / 2, cy); ctx.scale(sc, sc);
    panel(ctx, -w / 2, -h / 2, w, h, 18, 'rgba(255,255,255,0.96)', 'rgba(91,58,41,0.25)', 4);
    text(ctx, b.title, 0, -10, { size: 19, color: C.pinkDeep });
    text(ctx, b.sub, 0, 14, { size: 12, color: C.inkSoft });
    ctx.restore();
  }

  // ---------------- 弹窗 ----------------
  drawModal(ctx, L) {
    const m = this.modal;
    const app = this.app;
    const W = P.W, H = P.H;
    const pop = m.t < 0.25 ? Ease.outBack(m.t / 0.25) : 1;
    if (m.type === 'wait') { app.hit(0, 0, W, H, null); return; }

    if (m.type === 'tips') {
      const tips = this.def.tips;
      const tip = tips[m.i];
      const md = modal(app, ctx, { w: 330, h: 240, y: H - 240 - Math.max(20, P.safeBottom + 10) - 40, scale: pop, title: m.i === 0 ? this.def.name : null });
      const avKind = tip.who === 'player' ? null : tip.who;
      const img = avKind ? petImg(avKind, tip.who === 'shiba' ? 3 : 0) : IMG.player_0;
      drawSprite(ctx, img, md.x + 56, md.y + 138, avKind ? 88 : 112);
      const nm = avKind ? R.PET_DEFS[avKind].name : '铲屎官（你）';
      text(ctx, nm, md.x + 56, md.y + 156, { size: 12, color: C.inkSoft });
      textBlock(ctx, tip.text, md.x + 104, md.y + 30, md.w - 120, { size: 14, align: 'left', lineHeight: 22 });
      const last = m.i >= tips.length - 1;
      app.button(ctx, md.x + md.w - 140, md.y + md.h - 58, 124, 42, last ? '开始！' : '下一句', () => {
        if (last) { Save.markSeen('tips_' + this.def.id); this.modal = null; this.morningBanner(); }
        else { m.i++; m.t = 0.25; }
      }, { size: 16 });
      app.button(ctx, md.x + 16, md.y + md.h - 54, 70, 34, '跳过', () => { Save.markSeen('tips_' + this.def.id); this.modal = null; this.morningBanner(); }, { color: '#EDE4DA', edge: '#D5C8BA', textColor: C.inkSoft, size: 13 });
      text(ctx, (m.i + 1) + '/' + tips.length, md.x + md.w / 2 - 20, md.y + md.h - 36, { size: 12, color: C.inkSoft });
      md.end();
      return;
    }

    if (m.type === 'rules') {
      const md = modal(app, ctx, { w: 340, h: 446, scale: pop, title: '规则速查', onBack: () => { this.modal = null; } });
      const lines = [
        '⚡ 每天 10 点体力：走 1 格 -1，喂食 / 摸摸 -2。',
        '🏠 每天必须回到【另一座】小屋。体力不够回家 = 回巢失败，当天好感全部清零！',
        '🦴 喂食要消耗零食：踩上去捡，最多带 3 个，每天刷新。',
        '同一只狗每天：喂食、摸摸各只能成功 1 次。',
        '通关：某天回到家的那一刻，所有狗狗好感达标。',
      ];
      let yy = md.y + 34;
      for (let i = 0; i < lines.length; i++) yy += textBlock(ctx, lines[i], md.x + 20, yy, md.w - 40, { size: 13, align: 'left', weight: 'normal', lineHeight: 19 }) + 6;
      yy += 4;
      for (let i = 0; i < this.g.pets.length; i++) {
        const d = R.PET_DEFS[this.g.pets[i].kind];
        drawSprite(ctx, petImg(d.kind, 0), md.x + 36, yy + 40, 40);
        text(ctx, d.name + '（' + d.trait + '）喂食+' + d.feed + ' 摸摸+' + d.pet, md.x + 62, yy + 10, { size: 12, align: 'left', color: d.color });
        yy += textBlock(ctx, d.rule, md.x + 62, yy + 20, md.w - 80, { size: 11, align: 'left', weight: 'normal', color: C.inkSoft, lineHeight: 15 }) + 26;
      }
      app.button(ctx, md.x + md.w / 2 - 70, md.y + md.h - 56, 140, 40, '知道了', () => { this.modal = null; });
      md.end();
      return;
    }

    if (m.type === 'quit' || m.type === 'restart') {
      const md = modal(app, ctx, { w: 300, h: 170, scale: pop, title: m.type === 'quit' ? '要离开吗？' : '重新开始？', onBack: () => { this.modal = null; } });
      text(ctx, '本关进度不会保存哦。', md.x + md.w / 2, md.y + 58, { size: 14, color: C.inkSoft });
      app.button(ctx, md.x + 18, md.y + md.h - 62, (md.w - 48) / 2, 42, '继续玩', () => { this.modal = null; }, { color: C.mint, edge: C.mintDeep });
      app.button(ctx, md.x + 30 + (md.w - 48) / 2, md.y + md.h - 62, (md.w - 48) / 2, 42, m.type === 'quit' ? '离开' : '重开', () => {
        if (m.type === 'quit') nav.go(this.daily ? 'menu' : 'select');
        else this.reset();
      });
      md.end();
      return;
    }

    if (m.type === 'night') {
      const a = Math.min(1, m.t / 0.4);
      ctx.fillStyle = 'rgba(30,38,78,' + (0.95 * a) + ')';
      ctx.fillRect(0, 0, W, H);
      app.hit(0, 0, W, H, () => {
        if (m.t < 0.6) return;
        this.modal = null;
        if (this.g.status === 'lost') this.modal = { type: 'lose', t: 0 };
        else this.morningBanner();
      });
      ctx.save();
      ctx.globalAlpha = a;
      for (let i = 0; i < 24; i++) {
        const sx = (i * 97) % W, sy = (i * 53) % (H * 0.5);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(this.time * 2 + i)) + ')';
        ctx.fillRect(sx, sy, 2, 2);
      }
      moon(ctx, W / 2, H * 0.2, 32);
      text(ctx, '第 ' + m.day + ' 天 · ' + (m.failed ? '回巢失败的夜晚' : '晚安'), W / 2, H * 0.2 + 62, { size: 20, color: '#FFFFFF' });
      let yy = H * 0.2 + 100;
      const g = this.g;
      const lines = [];
      for (let i = 0; i < m.report.length; i++) {
        const r = m.report[i];
        const nm = R.PET_DEFS[g.pets[r.pet].kind].name;
        if (r.t === 'rollback') lines.push({ s: nm + ' 好感 ' + r.v + '（今天的全部清零）', c: '#FFB3B3' });
        else if (r.t === 'decay') lines.push({ s: nm + ' 夜里好感 ' + r.v + (r.cold ? '（被冷落了…）' : '（高冷）'), c: '#FFD9A8' });
        else if (r.t === 'walk') lines.push({ s: nm + ' 去散步了，换了个位置', c: '#BFD8FF' });
      }
      if (!lines.length) lines.push({ s: '狗狗们睡得很香 zZ', c: '#DDE3FF' });
      for (let i = 0; i < lines.length; i++) { text(ctx, lines[i].s, W / 2, yy, { size: 14, color: lines[i].c }); yy += 26; }
      yy += 10;
      if (g.status !== 'lost') {
        text(ctx, '明天：' + this.houseName(g.startIdx) + ' → ' + this.houseName(1 - g.startIdx), W / 2, yy, { size: 14, color: '#FFFFFF' });
        yy += 26;
        text(ctx, '还剩 ' + (g.maxDays - g.day + 1) + ' 天', W / 2, yy, { size: 13, color: '#C9D1FF' });
      } else {
        text(ctx, '……天数用完了', W / 2, yy, { size: 15, color: '#FFB3B3' });
      }
      if (m.t > 0.6) text(ctx, '点击任意处继续', W / 2, H * 0.82, { size: 13, color: 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(this.time * 4)) + ')' });
      ctx.restore();
      return;
    }

    if (m.type === 'fail') {
      if (m.t < 1.4) { app.hit(0, 0, W, H, null); return; }
      const t = m.t - 1.4;
      const sc = t < 0.25 ? Ease.outBack(t / 0.25) : 1;
      const md = modal(app, ctx, { w: 330, h: 352, scale: sc, title: '回巢失败！', titleColor: C.red, titleEdge: '#C94A43' });
      const g = this.g;
      // 狗狗们集体翻白眼
      const n = g.pets.length;
      for (let i = 0; i < n; i++) {
        const px = md.x + md.w / 2 + (i - (n - 1) / 2) * 72;
        drawSprite(ctx, petImg(g.pets[i].kind, 2), px, md.y + 152, 72);
      }
      bubble(ctx, '「' + m.roast + '」', md.x + md.w / 2, md.y + 82, { size: 14, maxW: 240 });
      text(ctx, '体力不够回家，今天刷的好感全部清零…', md.x + md.w / 2, md.y + 172, { size: 13, color: C.inkSoft });
      const canRetry = this.retryLeft > 0;
      app.button(ctx, md.x + 20, md.y + 190, md.w - 40, 44, canRetry ? '重来今天（剩 ' + this.retryLeft + ' 次）' : '重来次数用完了', () => this.restartDay(), { disabled: !canRetry, color: C.mint, edge: C.mintDeep, size: 15 });
      if (canRetry) text(ctx, '正式版：看一段视频获得', md.x + md.w / 2, md.y + 246, { size: 11, color: C.inkSoft, weight: 'normal' });
      app.button(ctx, md.x + 20, md.y + 260, md.w - 40, 42, '认了，直接过夜', () => { this.modal = null; this.startNight(true); }, { color: C.pink, size: 15 });
      app.button(ctx, md.x + md.w / 2 - 70, md.y + 312, 140, 28, '分享吐槽给好友', () => this.shareRoast(), { color: '#FFFFFF', edge: '#E3D6C9', textColor: C.ink, size: 12, r: 14 });
      md.end();
      return;
    }

    if (m.type === 'win' || m.type === 'lose') {
      const delay = m.type === 'win' ? 0.9 : 0.1;
      if (m.t < delay) { app.hit(0, 0, W, H, null); return; }
      const t = m.t - delay;
      const sc = t < 0.25 ? Ease.outBack(t / 0.25) : 1;
      const win = m.type === 'win';
      const md = modal(app, ctx, { w: 330, h: win ? (this.daily || (this.result.hard && this.result.stars === 3) ? 360 : 330) : 300, scale: sc, title: win ? (this.daily ? '今日挑战完成！' : '攻略成功！') : '天数用完啦…', titleColor: win ? C.pink : C.grey, titleEdge: win ? C.pinkDeep : '#958A80' });
      const g = this.g;
      const n = g.pets.length;
      for (let i = 0; i < n; i++) {
        const px = md.x + md.w / 2 + (i - (n - 1) / 2) * 72;
        const bounce = win ? Math.abs(Math.sin(this.time * 6 + i)) * 5 : 0;
        drawSprite(ctx, petImg(g.pets[i].kind, win ? 1 : 3), px, md.y + 110 - bounce, 70);
      }
      if (win) {
        const r = this.result;
        for (let i = 0; i < 3; i++) {
          const st = t - 0.3 - i * 0.25;
          const on = i < r.stars && st > 0;
          const s = on ? (st < 0.25 ? Ease.outBack(st / 0.25) : 1) : 1;
          drawIcon(ctx, IMG.ic_star, md.x + md.w / 2 + (i - 1) * 50, md.y + 150 - (i === 1 ? 6 : 0), 42, { alpha: on ? 1 : 0.2, scale: s });
        }
        const crit = [
          { ok: true, s: '通关' },
          { ok: r.strands === 0, s: '没有回巢失败' + (r.strands ? '（失败 ' + r.strands + ' 次）' : '') },
          { ok: r.day <= this.def.par, s: this.def.par + ' 天内通关（本次 ' + r.day + ' 天）' },
        ];
        for (let i = 0; i < 3; i++) {
          text(ctx, (crit[i].ok ? '✓ ' : '✗ ') + crit[i].s, md.x + 60, md.y + 188 + i * 22, { size: 13, align: 'left', color: crit[i].ok ? C.mintDeep : C.grey });
        }
        if (this.daily) text(ctx, '🔥 连续打卡 ' + Save.streak() + ' 天', md.x + md.w / 2, md.y + 262, { size: 14, color: C.orange });
        else if (r.hard && r.stars === 3) text(ctx, '🏅 硬核模式三星，获得勋章！', md.x + md.w / 2, md.y + 262, { size: 13, color: C.orange });
        const nx = nextLevel(this.def.id);
        const nxIdx = nx ? LEVELS.indexOf(nx) : -1;
        const canNext = !this.daily && nx && Save.unlocked(nxIdx);
        const bw = (md.w - 52) / 2;
        app.button(ctx, md.x + 20, md.y + md.h - 62, bw, 44, '再来一次', () => this.reset(), { color: C.mint, edge: C.mintDeep, size: 15 });
        if (canNext) app.button(ctx, md.x + 32 + bw, md.y + md.h - 62, bw, 44, '下一关', () => nav.go('play', nx), { size: 15 });
        else app.button(ctx, md.x + 32 + bw, md.y + md.h - 62, bw, 44, this.daily ? '回主页' : '选关', () => nav.go(this.daily ? 'menu' : 'select'), { size: 15 });
        if (!this.daily && nx && !Save.unlocked(nxIdx)) text(ctx, '第二章需要第一章累计 5 颗星', md.x + md.w / 2, md.y + md.h - 76, { size: 11, color: C.inkSoft, weight: 'normal' });
      } else {
        const unmet = g.pets.filter((p) => p.aff < p.target).map((p) => R.PET_DEFS[p.kind].name + ' ' + p.aff + '/' + p.target);
        text(ctx, '还没攻略下：' + unmet.join('，'), md.x + md.w / 2, md.y + 140, { size: 13, color: C.inkSoft });
        text(ctx, '小技巧：试试「提示」，它会算出最优路线', md.x + md.w / 2, md.y + 166, { size: 12, color: C.orange, weight: 'normal' });
        const bw = (md.w - 52) / 2;
        app.button(ctx, md.x + 20, md.y + md.h - 70, bw, 44, '返回', () => nav.go(this.daily ? 'menu' : 'select'), { color: C.mint, edge: C.mintDeep, size: 15 });
        app.button(ctx, md.x + 32 + bw, md.y + md.h - 70, bw, 44, '再试一次', () => this.reset(), { size: 15 });
      }
      md.end();
    }
  }
}
