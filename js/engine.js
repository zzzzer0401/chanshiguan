// 轻量引擎：主循环、场景切换、即时模式 UI 命中区域、绘图工具
import P from './platform.js';

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",sans-serif';

export const C = {
  cream: '#FFF6E9', ink: '#5B3A29', inkSoft: '#8A6A55', pink: '#FF8FAB', pinkDeep: '#F06C8F',
  mint: '#7ED6B5', mintDeep: '#4DB892', yellow: '#FFD25A', orange: '#FFB15C', red: '#F2665E',
  sky: '#8FD3FF', blue: '#5AA9E6', grassA: '#BFE39F', grassB: '#B0DA8F', wood: '#D9A066', woodDark: '#B07A45',
  white: '#FFFFFF', grey: '#B9AFA6', night: '#2E3A66',
};

export const Ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
export function fillRR(ctx, x, y, w, h, r, color) { rrPath(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
export function strokeRR(ctx, x, y, w, h, r, color, lw) { rrPath(ctx, x, y, w, h, r); ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.stroke(); }

// 带“底部厚边”的软萌面板
export function panel(ctx, x, y, w, h, r, fill, edge, depth) {
  depth = depth === undefined ? 4 : depth;
  if (depth > 0) fillRR(ctx, x, y + depth, w, h, r, edge || 'rgba(91,58,41,0.25)');
  fillRR(ctx, x, y, w, h, r, fill);
}

export function text(ctx, str, x, y, o) {
  o = o || {};
  const size = o.size || 14;
  ctx.font = (o.weight || 'bold') + ' ' + size + 'px ' + FONT;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.strokeWidth || 4;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color || C.ink;
  ctx.fillText(str, x, y);
}

export function measure(ctx, str, size, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
  return ctx.measureText(str).width;
}

// 自动换行（按字符，适配中文）
export function wrapLines(ctx, str, maxW, size, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
  const out = [];
  const paras = String(str).split('\n');
  for (let p = 0; p < paras.length; p++) {
    let line = '';
    const chars = Array.from(paras[p]);
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = chars[i]; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function textBlock(ctx, str, x, y, maxW, o) {
  o = o || {};
  const size = o.size || 14, lh = o.lineHeight || size * 1.45;
  const lines = wrapLines(ctx, str, maxW, size, o.weight);
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], x, y + i * lh, Object.assign({ baseline: 'top' }, o));
  return lines.length * lh;
}

// 以底部中心为锚点按高度绘制图片
export function drawSprite(ctx, img, cx, bottom, h, o) {
  if (!img) return;
  o = o || {};
  const w = h * img.width / img.height;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(cx, bottom);
  if (o.rot) ctx.rotate(o.rot);
  const sx = (o.sx || 1) * (o.flip ? -1 : 1), sy = o.sy || 1;
  ctx.scale(sx, sy);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

// 以中心点绘制、按最大边适配
export function drawIcon(ctx, img, cx, cy, size, o) {
  if (!img) return;
  o = o || {};
  const s = size / Math.max(img.width, img.height);
  const w = img.width * s, h = img.height * s;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(cx, cy);
  if (o.rot) ctx.rotate(o.rot);
  if (o.scale) ctx.scale(o.scale, o.scale);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawCover(ctx, img, x, y, w, h) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export class App {
  constructor() {
    this.scene = null;
    this.next = null;
    this.fade = 0; // 场景切换遮罩
    this.fadeDir = 0;
    this.hits = [];
    this.pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, t: 0 };
    this.toasts = [];
    this.time = 0;
    this.last = P.now();
    P.onTouch((type, x, y) => this.onTouch(type, x, y));
  }

  start(scene) {
    this.scene = scene;
    if (scene.enter) scene.enter();
    const loop = () => {
      const t = P.now();
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (dt > 0.1) dt = 0.1;
      this.frame(dt);
      P.raf(loop);
    };
    P.raf(loop);
  }

  go(scene) {
    if (this.fadeDir !== 0) return;
    this.next = scene;
    this.fadeDir = 1;
  }

  toast(msg, color, dur) {
    this.toasts.push({ msg: msg, color: color || C.ink, t: 0, dur: dur || 2.2 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  // 即时模式：每帧注册的可点击区域
  hit(x, y, w, h, cb, opts) {
    this.hits.push({ x: x, y: y, w: w, h: h, cb: cb, opts: opts || {} });
  }
  isPressed(x, y, w, h) {
    const p = this.pointer;
    return p.down && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  onTouch(type, x, y) {
    const p = this.pointer;
    if (type === 'down') {
      p.down = true; p.x = p.sx = x; p.y = p.sy = y; p.t = this.time;
      if (this.scene && this.scene.onDown) this.scene.onDown(x, y);
    } else if (type === 'move') {
      p.x = x; p.y = y;
      if (this.scene && this.scene.onMove) this.scene.onMove(x, y);
    } else {
      p.down = false; p.x = x; p.y = y;
      if (this.fadeDir !== 0) return;
      const moved = Math.abs(x - p.sx) + Math.abs(y - p.sy);
      if (moved > 18) { if (this.scene && this.scene.onDragEnd) this.scene.onDragEnd(x, y); return; }
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
          if (h.cb) h.cb(x, y);
          return;
        }
      }
      if (this.scene && this.scene.onTap) this.scene.onTap(x, y);
    }
  }

  frame(dt) {
    this.time += dt;
    const ctx = P.ctx;
    ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
    ctx.globalAlpha = 1;
    this.hits = [];
    this.toastY = null;
    if (this.fadeDir === 1) {
      this.fade += dt * 5;
      if (this.fade >= 1) {
        this.fade = 1; this.fadeDir = -1;
        if (this.scene && this.scene.exit) this.scene.exit();
        this.scene = this.next; this.next = null;
        this.toasts = [];
        if (this.scene.enter) this.scene.enter();
      }
    } else if (this.fadeDir === -1) {
      this.fade -= dt * 4;
      if (this.fade <= 0) { this.fade = 0; this.fadeDir = 0; }
    }
    if (this.scene) {
      if (this.scene.update) this.scene.update(dt);
      this.scene.draw(ctx);
    }
    this.drawToasts(ctx, dt);
    if (this.fade > 0) {
      ctx.fillStyle = 'rgba(255,246,233,' + this.fade + ')';
      ctx.fillRect(0, 0, P.W, P.H);
    }
  }

  drawToasts(ctx, dt) {
    let y = this.toastY || P.H * 0.22;
    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      t.t += dt;
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > t.dur - 0.3 ? Math.max(0, (t.dur - t.t) / 0.3) : 1;
      const lines = wrapLines(ctx, t.msg, P.W - 80, 14);
      let w = 0;
      for (let j = 0; j < lines.length; j++) w = Math.max(w, measure(ctx, lines[j], 14));
      w += 32;
      const h = lines.length * 20 + 16;
      ctx.save();
      ctx.globalAlpha = a;
      const yy = y - (1 - a) * 10;
      panel(ctx, (P.W - w) / 2, yy, w, h, h / 2 > 20 ? 14 : h / 2, 'rgba(255,255,255,0.97)', 'rgba(91,58,41,0.2)', 3);
      for (let j = 0; j < lines.length; j++) text(ctx, lines[j], P.W / 2, yy + 8 + 10 + j * 20, { size: 14, color: t.color });
      ctx.restore();
      y += h + 8;
    }
    this.toasts = this.toasts.filter((t) => t.t < t.dur);
  }

  // 通用按钮（即时模式），返回按钮矩形
  button(ctx, x, y, w, h, label, cb, o) {
    o = o || {};
    const pressed = !o.disabled && this.isPressed(x, y, w, h);
    const color = o.disabled ? '#E4DCD3' : (o.color || C.pink);
    const edge = o.disabled ? '#CFC4B8' : (o.edge || C.pinkDeep);
    const dy = pressed ? 3 : 0;
    const r = o.r === undefined ? Math.min(h / 2, 18) : o.r;
    fillRR(ctx, x, y + 4, w, h, r, edge);
    fillRR(ctx, x, y + dy, w, h, r, color);
    // 高光
    ctx.save();
    ctx.globalAlpha = 0.35;
    fillRR(ctx, x + 6, y + dy + 4, w - 12, Math.max(4, h * 0.22), r * 0.6, '#FFFFFF');
    ctx.restore();
    const tc = o.disabled ? '#A99C90' : (o.textColor || '#FFFFFF');
    let tx = x + w / 2;
    if (o.icon) {
      const isz = o.iconSize || h * 0.58;
      const lw = label ? measure(ctx, label, o.size || 16) : 0;
      const total = isz + (label ? 6 + lw : 0);
      const ix = x + (w - total) / 2 + isz / 2;
      drawIcon(ctx, o.icon, ix, y + dy + h / 2, isz, { alpha: o.disabled ? 0.45 : 1 });
      tx = ix + isz / 2 + 6 + lw / 2;
    }
    if (label) text(ctx, label, tx, y + dy + h / 2 + 1, { size: o.size || 16, color: tc, stroke: o.disabled ? null : (o.textStroke || null), strokeWidth: 3 });
    if (!o.disabled && cb) this.hit(x, y, w, h + 4, cb);
    else if (o.disabled && o.onDisabled) this.hit(x, y, w, h + 4, o.onDisabled);
    return { x: x, y: y, w: w, h: h };
  }
}
