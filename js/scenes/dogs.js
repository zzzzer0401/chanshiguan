// 狗狗档案 / 羁绊
import P from '../platform.js';
import IMG, { petImg } from '../assets.js';
import { C, fillRR, panel, text, textBlock, drawSprite, drawIcon, wrapLines } from '../engine.js';
import { PET_DEFS, PET_ORDER } from '../rules.js';
import Save, { QUOTES, BOND_STEPS } from '../save.js';
import { backButton } from '../ui.js';
import { heartBar } from '../ui.js';
import nav from '../nav.js';

export default class DogsScene {
  constructor(app) { this.app = app; this.sy = 0; this.drag = null; this.maxScroll = 0; this.time = 0; }
  update(dt) { this.time += dt; }
  onDown(x, y) { this.drag = { y: y, sy: this.sy }; }
  onMove(x, y) { if (this.drag) this.sy = Math.max(-this.maxScroll, Math.min(0, this.drag.sy + (y - this.drag.y))); }
  onDragEnd() { this.drag = null; }

  draw(ctx) {
    const app = this.app, W = P.W, H = P.H;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#FFEFF3'); grd.addColorStop(1, '#FFF6E9');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const top = P.capsule ? P.capsule.top : P.safeTop;
    const headH = P.capsule ? Math.max(34, P.capsule.height) : 34;
    const contentTop = top + headH + 12;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, contentTop, W, H - contentTop); ctx.clip();
    let y = contentTop + 4 + this.sy;
    text(ctx, '通关获得的星星会提升对应狗狗的羁绊，解锁专属语录', W / 2, y + 8, { size: 12, color: C.inkSoft, weight: 'normal' });
    y += 26;
    for (let i = 0; i < PET_ORDER.length; i++) {
      const kind = PET_ORDER[i];
      const d = PET_DEFS[kind];
      const lv = Save.bondLevel(kind);
      const pts = Save.bondPoints(kind);
      // 按内容计算卡片高度
      const tw0 = W - 24 - 128;
      let need = 14 + wrapLines(ctx, d.rule, tw0, 12, 'normal').length * 17 + 8;
      for (let q = 0; q < 4; q++) need += q <= lv ? wrapLines(ctx, '「' + QUOTES[kind][q] + '」', tw0 - 8, 12).length * 17 + 12 : 26;
      const ch = Math.max(262, need + 10);
      panel(ctx, 12, y, W - 24, ch, 20, '#FFFFFF', 'rgba(91,58,41,0.15)', 4);
      fillRR(ctx, 12, y, 108, ch, 20, d.color);
      fillRR(ctx, 80, y, 40, ch, 0, d.color);
      const face = Math.floor(this.time / 2 + i) % 4 === 0 ? 1 : 0;
      drawSprite(ctx, petImg(kind, face), 66, y + 128, 92);
      text(ctx, d.name, 66, y + 150, { size: 18, color: '#FFFFFF' });
      text(ctx, d.breed + ' · ' + d.trait, 66, y + 172, { size: 12, color: 'rgba(255,255,255,0.9)' });
      text(ctx, '羁绊 Lv.' + (lv + 1), 66, y + 204, { size: 15, color: '#FFFFFF' });
      const next = BOND_STEPS[lv + 1];
      heartBar(ctx, 26, y + 220, 80, 8, next ? pts - BOND_STEPS[lv] : 1, next ? next - BOND_STEPS[lv] : 1, '#FFFFFF');
      text(ctx, next ? pts + ' / ' + next : 'MAX', 66, y + 242, { size: 11, color: 'rgba(255,255,255,0.9)' });
      const tx = 132, tw = W - 24 - 128;
      let yy = y + 14;
      yy += textBlock(ctx, d.rule, tx, yy, tw, { size: 12, align: 'left', weight: 'normal', color: C.inkSoft, lineHeight: 17 }) + 8;
      for (let q = 0; q < 4; q++) {
        const open = q <= lv;
        fillRR(ctx, tx - 4, yy - 2, tw - 4, 1, 0, 'rgba(91,58,41,0.08)');
        if (open) yy += textBlock(ctx, '「' + QUOTES[kind][q] + '」', tx, yy + 4, tw - 8, { size: 12, align: 'left', lineHeight: 17, color: C.ink }) + 8;
        else { text(ctx, '🔒 羁绊 Lv.' + (q + 1) + ' 解锁', tx, yy + 12, { size: 12, align: 'left', color: C.grey, weight: 'normal' }); yy += 26; }
      }
      y += ch + 14;
    }
    text(ctx, '正式版：羁绊还会解锁装扮、相册和动态表情', W / 2, y + 6, { size: 12, color: C.inkSoft, weight: 'normal' });
    y += 30;
    this.maxScroll = Math.max(0, y - this.sy - H);
    ctx.restore();
    backButton(app, ctx, 10, top + (headH - 34) / 2, () => nav.go('menu'));
    text(ctx, '狗狗档案', 52, top + headH / 2, { size: 18, align: 'left' });
  }
}
