// 平台适配层：同一套代码跑在微信小游戏 和 浏览器（预览用）
/* global wx */
const isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

const P = {
  isWx: isWx,
  W: 375, H: 667, dpr: 2,
  safeTop: 20, safeBottom: 0,
  capsule: null, // 微信右上角胶囊按钮区域
  canvas: null, ctx: null,
  _touch: null,
  _resize: null,
};

function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}
P.now = now;

if (isWx) {
  const info = wx.getSystemInfoSync();
  P.canvas = wx.createCanvas();
  P.W = info.windowWidth; P.H = info.windowHeight;
  P.dpr = Math.min(info.pixelRatio || 2, 3);
  P.canvas.width = P.W * P.dpr; P.canvas.height = P.H * P.dpr;
  P.ctx = P.canvas.getContext('2d');
  let menu = null;
  try { menu = wx.getMenuButtonBoundingClientRect(); } catch (e) { menu = null; }
  if (menu && menu.width) {
    P.capsule = { left: menu.left, top: menu.top, bottom: menu.bottom, height: menu.height };
    P.safeTop = menu.top;
  } else {
    P.safeTop = info.safeArea ? info.safeArea.top + 4 : 24;
  }
  P.safeBottom = info.safeArea ? Math.max(0, P.H - info.safeArea.bottom) : 0;
  const fwd = (type) => (e) => {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (t && P._touch) P._touch(type, t.clientX, t.clientY);
  };
  wx.onTouchStart(fwd('down'));
  wx.onTouchMove(fwd('move'));
  wx.onTouchEnd(fwd('up'));
  wx.onTouchCancel(fwd('up'));
  try { wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] }); } catch (e) { /* ignore */ }
  try {
    wx.onShareAppMessage(() => ({ title: '别吵，在刷好感呢！三只狗狗等你来攻略～' }));
  } catch (e) { /* ignore */ }
} else {
  const doc = document;
  const host = doc.getElementById('game-root');
  P.canvas = doc.createElement('canvas');
  (host || doc.body).appendChild(P.canvas);
  P.ctx = P.canvas.getContext('2d');
  const layout = () => {
    let iw = window.innerWidth, ih = window.innerHeight;
    if (host && host.clientWidth > 0 && host.clientHeight > 0) { iw = host.clientWidth; ih = host.clientHeight; }
    let w, h;
    if (iw >= 600) { // 桌面：模拟手机竖屏
      h = Math.min(ih - 24, 880); w = Math.round(h * 0.47);
    } else { w = iw; h = ih; }
    P.W = w; P.H = h;
    P.dpr = Math.min(window.devicePixelRatio || 1, 3);
    P.canvas.width = Math.round(w * P.dpr); P.canvas.height = Math.round(h * P.dpr);
    P.canvas.style.width = w + 'px'; P.canvas.style.height = h + 'px';
    P.safeTop = iw >= 600 ? 14 : 10;
    P.capsule = null;
    if (P._resize) P._resize();
  };
  layout();
  window.addEventListener('resize', layout);
  const pos = (e) => {
    const r = P.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (P.W / r.width), (e.clientY - r.top) * (P.H / r.height)];
  };
  let down = false;
  P.canvas.addEventListener('pointerdown', (e) => { down = true; P._gesture = true; const p = pos(e); P.canvas.setPointerCapture && P.canvas.setPointerCapture(e.pointerId); if (P._touch) P._touch('down', p[0], p[1]); e.preventDefault(); });
  P.canvas.addEventListener('pointermove', (e) => { if (!down) return; const p = pos(e); if (P._touch) P._touch('move', p[0], p[1]); });
  P.canvas.addEventListener('pointerup', (e) => { down = false; const p = pos(e); if (P._touch) P._touch('up', p[0], p[1]); });
  P.canvas.addEventListener('pointercancel', (e) => { down = false; const p = pos(e); if (P._touch) P._touch('up', p[0], p[1]); });
  P.canvas.style.touchAction = 'none';
}

P.onTouch = function (fn) { P._touch = fn; };
P.onResize = function (fn) { P._resize = fn; };

P.loadImage = function (src) {
  return new Promise((resolve) => {
    const img = isWx ? wx.createImage() : new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn('图片加载失败', src); resolve(null); };
    img.src = src;
  });
};

P.storageGet = function (key) {
  try {
    if (isWx) { const v = wx.getStorageSync(key); return v ? JSON.parse(v) : null; }
    const v = window.localStorage.getItem(key); return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
};
P.storageSet = function (key, val) {
  try {
    const s = JSON.stringify(val);
    if (isWx) wx.setStorageSync(key, s); else window.localStorage.setItem(key, s);
  } catch (e) { /* 存储不可用时静默 */ }
};

P.vibrate = function (heavy) {
  try {
    if (isWx) { if (heavy) wx.vibrateLong(); else wx.vibrateShort({ type: 'light' }); }
    else if (P._gesture && navigator.vibrate) navigator.vibrate(heavy ? 120 : 15);
  } catch (e) { /* ignore */ }
};

// 分享：微信内拉起分享面板；浏览器里返回 false 由游戏内提示
P.share = function (title, query) {
  if (isWx) {
    try { wx.shareAppMessage({ title: title, query: query || '' }); return true; } catch (e) { return false; }
  }
  return false;
};

P.raf = function (fn) {
  if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(fn);
  return setTimeout(() => fn(now()), 16);
};

export default P;
