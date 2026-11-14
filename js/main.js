// 入口：加载资源 → 主菜单
import P from './platform.js';
import { App, C, text, fillRR } from './engine.js';
import { loadAll } from './assets.js';
import { dailyLevel } from './levels.js';
import nav from './nav.js';
import MenuScene from './scenes/menu.js';
import SelectScene from './scenes/select.js';
import PlayScene from './scenes/play.js';
import DogsScene from './scenes/dogs.js';

const app = new App();
nav.app = app;
nav.factories = {
  menu: () => new MenuScene(app),
  select: () => new SelectScene(app),
  play: (def) => new PlayScene(app, def),
  dogs: () => new DogsScene(app),
  daily: () => new PlayScene(app, dailyLevel()),
};

class LoadingScene {
  constructor() { this.p = 0; this.time = 0; }
  update(dt) { this.time += dt; }
  draw(ctx) {
    const W = P.W, H = P.H;
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
    text(ctx, '别吵，在刷好感呢！', W / 2, H * 0.42, { size: 26, color: C.pinkDeep });
    text(ctx, '狗狗们正在梳毛…', W / 2, H * 0.42 + 36, { size: 13, color: C.inkSoft, weight: 'normal' });
    const bw = Math.min(220, W - 80);
    fillRR(ctx, (W - bw) / 2, H * 0.42 + 60, bw, 12, 6, 'rgba(91,58,41,0.12)');
    fillRR(ctx, (W - bw) / 2, H * 0.42 + 60, Math.max(12, bw * this.p), 12, 6, C.pink);
  }
}

const loading = new LoadingScene();
app.start(loading);
loadAll((p) => { loading.p = p; }).then(() => nav.go('menu'));

// 浏览器预览调试用
if (!P.isWx && typeof window !== 'undefined') window.__game = { app: app, nav: nav };
