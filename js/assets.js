// 图片资源（AI 生成后切图，见 art_src/）
import P from './platform.js';

const NAMES = [
  'shiba_0', 'shiba_1', 'shiba_2', 'shiba_3',
  'collie_0', 'collie_1', 'collie_2', 'collie_3',
  'poodle_0', 'poodle_1', 'poodle_2', 'poodle_3',
  'player_0', 'player_1', 'player_2',
  'house_a', 'house_b', 'bush', 'mud', 'water', 'bone', 'fence', 'flower', 'ball',
  'ic_heart', 'ic_energy', 'ic_feed', 'ic_pet', 'ic_star', 'ic_undo', 'ic_hint', 'ic_home', 'ic_broken',
];

const IMG = {};

export function loadAll(onProgress) {
  let done = 0;
  const total = NAMES.length + 1;
  const tick = () => { done++; if (onProgress) onProgress(done / total); };
  const jobs = NAMES.map((n) => P.loadImage('images/' + n + '.png').then((img) => { IMG[n] = img; tick(); }));
  jobs.push(P.loadImage('images/menu_bg.jpg').then((img) => { IMG.menu_bg = img; tick(); }));
  return Promise.all(jobs);
}

// 表情：0 平静 1 开心 2 翻白眼 3 傲娇撇头
export function petImg(kind, face) { return IMG[kind + '_' + (face || 0)]; }

export default IMG;
