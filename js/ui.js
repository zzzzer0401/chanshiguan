// 通用界面组件
import P from './platform.js';
import IMG from './assets.js';
import { C, panel, fillRR, strokeRR, text, measure, wrapLines, drawIcon, FONT } from './engine.js';

// 对话气泡（指向下方 x,y）
export function bubble(ctx, str, x, y, o) {
  o = o || {};
  const size = o.size || 13;
  const maxW = o.maxW || 150;
  const lines = wrapLines(ctx, str, maxW, size);
  let w = 0;
  for (let i = 0; i < lines.length; i++) w = Math.max(w, measure(ctx, lines[i], size));
  w += 18;
  const lh = size + 5;
  const h = lines.length * lh + 12;
  let bx = x - w / 2;
  const minX = o.minX === undefined ? 6 : o.minX, maxX = o.maxX === undefined ? P.W - 6 : o.maxX;
  if (bx < minX) bx = minX;
  if (bx + w > maxX) bx = maxX - w;
  const by = y - h - 8;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  fillRR(ctx, bx, by + 2, w, h, 10, 'rgba(91,58,41,0.18)');
  fillRR(ctx, bx, by, w, h, 10, o.bg || '#FFFFFF');
  strokeRR(ctx, bx, by, w, h, 10, o.border || 'rgba(91,58,41,0.35)', 1.5);
  ctx.beginPath();
  const tx = Math.max(bx + 10, Math.min(bx + w - 10, x));
  ctx.moveTo(tx - 6, by + h - 1);
  ctx.lineTo(tx, by + h + 7);
  ctx.lineTo(tx + 6, by + h - 1);
  ctx.closePath();
  ctx.fillStyle = o.bg || '#FFFFFF';
  ctx.fill();
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], bx + w / 2, by + 6 + lh / 2 + i * lh, { size: size, color: o.color || C.ink });
  ctx.restore();
}

export function starsRow(ctx, cx, cy, n, size, gap, total) {
  total = total || 3;
  const w = total * size + (total - 1) * (gap || 2);
  let x = cx - w / 2 + size / 2;
  for (let i = 0; i < total; i++) {
    drawIcon(ctx, IMG.ic_star, x, cy, size, { alpha: i < n ? 1 : 0.22 });
    x += size + (gap || 2);
  }
}

export function heartBar(ctx, x, y, w, h, v, max, color) {
  fillRR(ctx, x, y, w, h, h / 2, 'rgba(91,58,41,0.12)');
  const r = Math.max(0, Math.min(1, v / max));
  if (r > 0) fillRR(ctx, x, y, Math.max(h, w * r), h, h / 2, color || C.pink);
}

export function backButton(app, ctx, x, y, cb) {
  const s = 34;
  const pressed = app.isPressed(x, y, s, s);
  fillRR(ctx, x, y + 3, s, s, s / 2, 'rgba(91,58,41,0.25)');
  fillRR(ctx, x, y + (pressed ? 2 : 0), s, s, s / 2, '#FFFFFF');
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2 + (pressed ? 2 : 0));
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(-4, 0); ctx.lineTo(3, 7); ctx.stroke();
  ctx.restore();
  app.hit(x - 6, y - 6, s + 12, s + 12, cb);
}

export function chip(ctx, str, x, y, o) {
  o = o || {};
  const size = o.size || 13;
  const w = measure(ctx, str, size) + (o.icon ? size + 22 : 18);
  const h = o.h || 26;
  const bx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  panel(ctx, bx, y, w, h, h / 2, o.bg || '#FFFFFF', 'rgba(91,58,41,0.18)', 2);
  let tx = bx + w / 2;
  if (o.icon) {
    drawIcon(ctx, o.icon, bx + 9 + size / 2, y + h / 2, size + 3);
    tx = bx + 9 + size + 4 + (w - size - 22) / 2 + 4;
  }
  text(ctx, str, tx, y + h / 2 + 1, { size: size, color: o.color || C.ink });
  return w;
}

// 模态框：返回内容区域；会先注册一个全屏拦截层
export function modal(app, ctx, o) {
  const W = P.W, H = P.H;
  ctx.fillStyle = 'rgba(46,35,30,' + (0.45 * (o.alpha === undefined ? 1 : o.alpha)) + ')';
  ctx.fillRect(0, 0, W, H);
  app.hit(0, 0, W, H, o.onBack || null);
  const w = Math.min(W - 36, o.w || 330);
  const h = o.h;
  const x = (W - w) / 2;
  const y = o.y === undefined ? (H - h) / 2 : o.y;
  const s = o.scale || 1;
  ctx.save();
  ctx.translate(W / 2, y + h / 2);
  ctx.scale(s, s);
  ctx.translate(-W / 2, -(y + h / 2));
  panel(ctx, x, y, w, h, 22, C.cream, 'rgba(91,58,41,0.35)', 6);
  strokeRR(ctx, x + 5, y + 5, w - 10, h - 10, 18, 'rgba(217,160,102,0.45)', 2);
  if (o.title) {
    const tw = measure(ctx, o.title, 20) + 44;
    panel(ctx, W / 2 - tw / 2, y - 16, tw, 38, 19, o.titleColor || C.pink, o.titleEdge || C.pinkDeep, 4);
    text(ctx, o.title, W / 2, y + 3, { size: 20, color: '#FFFFFF' });
  }
  return { x: x, y: y, w: w, h: h, end: () => ctx.restore() };
}

export function pawPrint(ctx, cx, cy, s, color, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.15, s * 0.32, 0, Math.PI * 2); ctx.fill();
  const toes = [[-0.36, -0.22], [-0.13, -0.42], [0.13, -0.42], [0.36, -0.22]];
  for (let i = 0; i < toes.length; i++) {
    ctx.beginPath(); ctx.arc(cx + toes[i][0] * s, cy + toes[i][1] * s, s * 0.13, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function moon(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,236,170,0.16)';
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFE9A8';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(214,178,110,0.45)';
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.25, cy + r * 0.3, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.35, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export { FONT };
