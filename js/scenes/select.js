// 选关
import P from '../platform.js';
import IMG, { petImg } from '../assets.js';
import { C, fillRR, strokeRR, panel, text, drawSprite, drawIcon } from '../engine.js';
import Save, { CH2_NEED } from '../save.js';
import { LEVELS, CHAPTERS } from '../levels.js';
import { backButton, chip, starsRow } from '../ui.js';
import nav from '../nav.js';

export default class SelectScene {
  constructor(app) { this.app = app; this.sy = 0; this.drag = null; this.maxScroll = 0; this.time = 0; }
  update(dt) { this.time += dt; }
  onDown(x, y) { this.drag = { y: y, sy: this.sy }; }
  onMove(x, y) {
    if (!this.drag) return;
    this.sy = Math.max(-this.maxScroll, Math.min(0, this.drag.sy + (y - this.drag.y)));
  }
  onDragEnd() { this.drag = null; }

  draw(ctx) {
    const app = this.app, W = P.W, H = P.H;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#FFF1DC'); grd.addColorStop(1, '#E6F5DA');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const top = P.capsule ? P.capsule.top : P.safeTop;
    const headH = P.capsule ? Math.max(34, P.capsule.height) : 34;
    const contentTop = top + headH + 12;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, contentTop, W, H - contentTop); ctx.clip();
    let y = contentTop + 6 + this.sy;
    const cols = 4, gap = 10;
    const tw = (W - 24 - gap * (cols - 1)) / cols;
    const th = tw * 1.12;
    for (let c = 0; c < CHAPTERS.length; c++) {
      const ch = CHAPTERS[c];
      const locked = ch.id === 2 && Save.chapterStars(1) < CH2_NEED;
      panel(ctx, 12, y, W - 24, 52, 16, ch.id === 1 ? '#FFD9E2' : '#D9ECFF', 'rgba(91,58,41,0.15)', 3);
      text(ctx, ch.name, 26, y + 18, { size: 16, align: 'left' });
      text(ctx, locked ? '🔒 第一章累计 ' + CH2_NEED + ' 颗⭐ 解锁（当前 ' + Save.chapterStars(1) + '）' : ch.sub, 26, y + 38, { size: 12, align: 'left', color: C.inkSoft, weight: 'normal' });
      const kinds = ch.id === 1 ? ['shiba', 'collie', 'poodle'] : ['poodle', 'collie', 'shiba'];
      for (let k = 0; k < 3; k++) drawSprite(ctx, petImg(kinds[k], ch.id === 1 ? 0 : 1), W - 40 - k * 30, y + 50, 40);
      y += 64;
      const list = LEVELS.filter((l) => l.chapter === ch.id);
      for (let i = 0; i < list.length; i++) {
        const L = list[i];
        const gi = LEVELS.indexOf(L);
        const un = Save.unlocked(gi);
        const st = Save.stars(L.id);
        const x = 12 + (i % cols) * (tw + gap);
        const yy = y + Math.floor(i / cols) * (th + gap);
        const pressed = un && app.isPressed(x, yy, tw, th) && !this.drag ? 3 : 0;
        panel(ctx, x, yy + pressed, tw, th, 16, un ? '#FFFFFF' : '#E8E0D8', un ? 'rgba(91,58,41,0.2)' : 'rgba(91,58,41,0.1)', 4 - pressed);
        if (un) {
          text(ctx, L.id, x + tw / 2, yy + th * 0.26 + pressed, { size: Math.round(tw * 0.24), color: st ? C.pinkDeep : C.ink });
          text(ctx, L.name, x + tw / 2, yy + th * 0.55 + pressed, { size: Math.max(10, Math.round(tw * 0.13)), color: C.inkSoft });
          starsRow(ctx, x + tw / 2, yy + th * 0.8 + pressed, st, tw * 0.2, 2);
          if (Save.medal(L.id)) text(ctx, '🏅', x + tw - 12, yy + 12, { size: 13 });
          const lv = L;
          app.hit(x, yy, tw, th, () => { if (!this.dragMoved()) nav.go('play', lv); });
        } else {
          text(ctx, '🔒', x + tw / 2, yy + th * 0.4, { size: Math.round(tw * 0.26) });
          text(ctx, L.id, x + tw / 2, yy + th * 0.72, { size: 13, color: C.grey });
          app.hit(x, yy, tw, th, () => app.toast(ch.id === 2 && locked ? '第一章累计 ' + CH2_NEED + ' 颗星解锁第二章' : '先通关上一关'));
        }
      }
      y += Math.ceil(list.length / cols) * (th + gap) + 14;
    }
    // 每日挑战入口
    panel(ctx, 12, y, W - 24, 70, 18, '#FFE7C2', 'rgba(224,138,46,0.5)', 4);
    drawIcon(ctx, IMG.ic_energy, 40, y + 35, 34);
    text(ctx, '每日挑战', 64, y + 24, { size: 16, align: 'left' });
    text(ctx, Save.dailyDone() ? '今日已完成 · 连续 ' + Save.streak() + ' 天' : '每天一张新地图，全服同题', 64, y + 47, { size: 12, align: 'left', color: C.inkSoft, weight: 'normal' });
    app.button(ctx, W - 106, y + 18, 80, 34, '去挑战', () => nav.go('daily'), { color: C.orange, edge: '#E08A2E', size: 14 });
    y += 90;
    const contentH = y - this.sy - contentTop;
    this.maxScroll = Math.max(0, contentH - (H - contentTop));
    ctx.restore();

    // 顶栏
    backButton(app, ctx, 10, top + (headH - 34) / 2, () => nav.go('menu'));
    text(ctx, '选择关卡', 52, top + headH / 2, { size: 18, align: 'left' });
    const right = P.capsule ? P.capsule.left - 8 : W - 10;
    chip(ctx, Save.totalStars() + ' / ' + LEVELS.length * 3, right, top + (headH - 26) / 2, { align: 'right', icon: IMG.ic_star, size: 13 });
  }
  dragMoved() { return false; }
}
