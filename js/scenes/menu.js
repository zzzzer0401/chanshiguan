// 主菜单
import P from '../platform.js';
import IMG, { petImg } from '../assets.js';
import { C, Ease, fillRR, panel, text, textBlock, drawSprite, drawCover, drawIcon } from '../engine.js';
import { PET_DEFS, PET_ORDER } from '../rules.js';
import Save, { QUOTES } from '../save.js';
import { LEVELS, todayKey } from '../levels.js';
import { bubble, chip, modal } from '../ui.js';
import nav from '../nav.js';

export default class MenuScene {
  constructor(app) {
    this.app = app;
    this.time = 0;
    this.faces = [0, 0, 0];
    this.until = [0, 0, 0];
    this.talk = null;
    this.modal = null;
  }
  enter() {}
  update(dt) {
    this.time += dt;
    if (this.talk) { this.talk.t += dt; if (this.talk.t > 2.6) this.talk = null; }
    if (this.modal) this.modal.t += dt;
    // 偶尔自己换个表情
    for (let i = 0; i < 3; i++) if (this.until[i] < this.time && Math.random() < dt * 0.15) { this.faces[i] = [1, 3, 2][Math.floor(Math.random() * 3)]; this.until[i] = this.time + 1.4; }
  }
  tapDog(i) {
    const kind = PET_ORDER[i];
    const lv = Save.bondLevel(kind);
    const q = QUOTES[kind][Math.floor(Math.random() * (lv + 1))];
    this.faces[i] = 1; this.until[i] = this.time + 1.6;
    this.talk = { i: i, text: q, t: 0 };
    P.vibrate(false);
  }

  draw(ctx) {
    const app = this.app, W = P.W, H = P.H;
    ctx.fillStyle = '#CDEBFF'; ctx.fillRect(0, 0, W, H);
    drawCover(ctx, IMG.menu_bg, 0, 0, W, H);
    const top = (P.capsule ? P.capsule.bottom : P.safeTop) + 20;
    // 标题
    const wob = Math.sin(this.time * 2) * 0.03;
    ctx.save();
    ctx.translate(W / 2, top + 42);
    ctx.rotate(-0.04 + wob * 0.5);
    const ts = Math.min(52, W * 0.13);
    text(ctx, '别吵，', -ts * 1.1, 3, { size: ts, color: 'rgba(91,58,41,0.35)' });
    text(ctx, '别吵，', -ts * 1.1, 0, { size: ts, color: C.orange, stroke: '#FFFFFF', strokeWidth: 10 });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2, top + 42 + ts * 1.1);
    ctx.rotate(0.02 - wob * 0.5);
    const ts2 = Math.min(46, W * 0.115);
    text(ctx, '在刷好感呢！', 0, 3, { size: ts2, color: 'rgba(91,58,41,0.35)' });
    text(ctx, '在刷好感呢！', 0, 0, { size: ts2, color: C.pinkDeep, stroke: '#FFFFFF', strokeWidth: 10 });
    ctx.restore();
    chip(ctx, '软萌狗狗 × 硬核算账', W / 2, top + 42 + ts * 1.1 + ts2 * 0.95, { align: 'center', size: 13, bg: 'rgba(255,255,255,0.92)', color: C.inkSoft });

    // 三只狗
    const dogY = Math.min(H * 0.5, top + 42 + ts * 1.1 + ts2 * 0.95 + 40 + W * 0.3);
    const ds = Math.min(W * 0.27, 120);
    for (let i = 0; i < 3; i++) {
      const kind = PET_ORDER[i];
      const x = W / 2 + (i - 1) * ds * 1.05;
      const face = this.until[i] > this.time ? this.faces[i] : 0;
      const bob = Math.abs(Math.sin(this.time * 2.4 + i * 1.3)) * (face === 1 ? 10 : 3);
      ctx.save();
      ctx.translate(x, dogY + 4); ctx.scale(1, 0.3);
      ctx.fillStyle = 'rgba(60,100,40,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, ds * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      drawSprite(ctx, petImg(kind, face), x, dogY - bob, ds);
      app.hit(x - ds * 0.45, dogY - ds, ds * 0.9, ds, () => this.tapDog(i));
    }
    if (this.talk) {
      const x = W / 2 + (this.talk.i - 1) * ds * 1.05;
      const a = this.talk.t < 0.15 ? this.talk.t / 0.15 : this.talk.t > 2.3 ? (2.6 - this.talk.t) / 0.3 : 1;
      bubble(ctx, this.talk.text, x, dogY - ds - 4, { size: 13, maxW: 170, alpha: a });
    }

    // 按钮
    const bw = Math.min(260, W - 80);
    let by = dogY + 30;
    const gap = Math.min(16, (H - by - 150) / 6);
    app.button(ctx, (W - bw) / 2, by, bw, 54, '开始闯关', () => nav.go('select'), { size: 20, textStroke: C.pinkDeep });
    by += 54 + gap + 6;
    const done = Save.dailyDone();
    app.button(ctx, (W - bw) / 2, by, bw, 48, done ? '每日挑战 ✓ 已完成' : '每日挑战', () => nav.go('daily'), { color: C.orange, edge: '#E08A2E', size: 17 });
    const streak = Save.streak();
    if (streak > 0) {
      fillRR(ctx, (W + bw) / 2 - 58, by - 9, 64, 20, 10, C.red);
      text(ctx, '🔥 ' + streak + '天', (W + bw) / 2 - 26, by + 1, { size: 11, color: '#FFFFFF' });
    }
    by += 48 + gap + 6;
    app.button(ctx, (W - bw) / 2, by, bw, 48, '狗狗档案', () => nav.go('dogs'), { color: C.mint, edge: C.mintDeep, size: 17 });
    by += 48 + gap + 8;
    const hc = Save.hardcore;
    const sw = (bw - 10) / 2;
    app.button(ctx, (W - bw) / 2, by, sw, 34, hc ? '硬核模式：开' : '硬核模式：关', () => { this.modal = { type: 'hard', t: 0 }; }, { color: hc ? C.ink : '#FFFFFF', edge: hc ? '#3A251A' : 'rgba(91,58,41,0.25)', textColor: hc ? '#FFFFFF' : C.ink, size: 13, r: 12 });
    app.button(ctx, (W - bw) / 2 + sw + 10, by, sw, 34, '玩法说明', () => { this.modal = { type: 'help', t: 0 }; }, { color: '#FFFFFF', edge: 'rgba(91,58,41,0.25)', textColor: C.ink, size: 13, r: 12 });
    const total = Save.totalStars();
    text(ctx, '已收集 ⭐ ' + total + ' / ' + LEVELS.length * 3 + '　·　Demo v0.1', W / 2, H - Math.max(16, P.safeBottom + 10), { size: 12, color: '#FFFFFF', stroke: 'rgba(91,58,41,0.5)', strokeWidth: 3 });

    if (this.modal) this.drawModal(ctx);
  }

  drawModal(ctx) {
    const app = this.app, m = this.modal, W = P.W;
    const pop = m.t < 0.25 ? Ease.outBack(m.t / 0.25) : 1;
    if (m.type === 'hard') {
      const on = Save.hardcore;
      const md = modal(app, ctx, { w: 320, h: 230, scale: pop, title: '硬核模式', titleColor: C.ink, titleEdge: '#3A251A', onBack: () => { this.modal = null; } });
      textBlock(ctx, '关闭「白点/红格」安全提示，以及走向死路时的二次确认。\n\n真正的铲屎官只靠心算回家。硬核模式下三星通关可获得 🏅 勋章。', md.x + 22, md.y + 34, md.w - 44, { size: 13, align: 'left', weight: 'normal', lineHeight: 20 });
      app.button(ctx, md.x + 20, md.y + md.h - 60, md.w - 40, 42, on ? '关闭硬核模式' : '开启硬核模式', () => { Save.setHardcore(!on); this.modal = null; app.toast(on ? '已关闭硬核模式' : '硬核模式已开启，祝你好运 🫡'); }, { color: on ? C.mint : C.ink, edge: on ? C.mintDeep : '#3A251A', size: 15 });
      md.end();
    } else if (m.type === 'help') {
      const md = modal(app, ctx, { w: 340, h: 430, scale: pop, title: '怎么玩', onBack: () => { this.modal = null; } });
      const lines = [
        '1. 每天 10 点体力⚡：走一格 -1，喂食 / 摸摸 -2。',
        '2. 每天从一座小屋出发，必须回到【另一座】小屋。',
        '3. 体力不够回家 = 回巢失败：当天好感全部清零，狗狗集体翻白眼。',
        '4. 在限定天数内，让所有狗狗好感达标就通关。',
      ];
      let yy = md.y + 32;
      for (let i = 0; i < lines.length; i++) yy += textBlock(ctx, lines[i], md.x + 20, yy, md.w - 40, { size: 13, align: 'left', weight: 'normal', lineHeight: 19 }) + 5;
      yy += 6;
      for (let i = 0; i < PET_ORDER.length; i++) {
        const d = PET_DEFS[PET_ORDER[i]];
        drawSprite(ctx, petImg(d.kind, 0), md.x + 38, yy + 42, 42);
        text(ctx, d.name + ' · ' + d.breed + '（' + d.trait + '）', md.x + 66, yy + 10, { size: 13, align: 'left', color: d.color });
        yy += textBlock(ctx, d.rule, md.x + 66, yy + 20, md.w - 84, { size: 11, align: 'left', weight: 'normal', color: C.inkSoft, lineHeight: 15 }) + 28;
      }
      app.button(ctx, md.x + md.w / 2 - 70, md.y + md.h - 56, 140, 40, '开玩！', () => { this.modal = null; });
      md.end();
    }
  }
}
export { todayKey };
