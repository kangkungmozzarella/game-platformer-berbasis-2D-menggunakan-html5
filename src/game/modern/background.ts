import { seeded } from '../../engine/pixel';
import type { ThemeName } from '../background';
import { BASE_VIEW_W, MAX_VIEW_W, VIEW_H, VIEW_W } from '../constants';
import { circle, ellipse, hiCanvas, paint, rgrad, roundRect, vgrad, type Ctx } from './draw';

interface Theme {
  sky: [string, string, string];
  sun: string;
  sunGlow: string;
  sunX: number;
  sunY: number;
  sunR: number;
  mountain: [string, string];
  haze: string;
  smoke: string;
  hills: [string, string];
  tree: [string, string];
  field: [string, string];
  wall: string;
  roof: string;
  window: string;
  cloud: [string, string];
  /** Colour wash over the whole scene; null for none. */
  tint: string | null;
  fireflies: boolean;
}

const THEMES: Record<ThemeName, Theme> = {
  pagi: {
    sky: ['#7cc2f2', '#bfe4f8', '#ffeacb'], sun: '#fff8dc', sunGlow: '255,236,170', sunX: 300, sunY: 52, sunR: 13,
    mountain: ['#b4cde6', '#93b3d6'], haze: '255,244,226', smoke: '#f4f6f8',
    hills: ['#9fd283', '#74b763'], tree: ['#5f9e58', '#3f7a44'], field: ['#b4dc84', '#8cc464'],
    wall: '#c8915e', roof: '#8a5236', window: '#5a3a26', cloud: ['#ffffff', '#dceaf6'], tint: null, fireflies: false,
  },
  siang: {
    sky: ['#4fa6ea', '#9fd4f6', '#dff3fb'], sun: '#fffdf0', sunGlow: '255,248,200', sunX: 70, sunY: 32, sunR: 12,
    mountain: ['#a4c2e2', '#84a8d2'], haze: '235,248,255', smoke: '#f7f9fb',
    hills: ['#92cc76', '#64ab58'], tree: ['#549a50', '#36703e'], field: ['#a8d878', '#7fbe58'],
    wall: '#c8915e', roof: '#7e4a30', window: '#5a3a26', cloud: ['#ffffff', '#d6e8f6'], tint: null, fireflies: false,
  },
  sore: {
    sky: ['#6a9ad6', '#f3c9a0', '#ffd99a'], sun: '#fff1c4', sunGlow: '255,200,120', sunX: 96, sunY: 98, sunR: 16,
    mountain: ['#a8a8c8', '#8a8cb4'], haze: '255,220,180', smoke: '#f6e6da',
    hills: ['#a6c472', '#7aa458'], tree: ['#5e8a48', '#3e663a'], field: ['#c8d27a', '#9ebc5c'],
    wall: '#c08454', roof: '#7a4630', window: '#ffd07a', cloud: ['#fff6e6', '#f2cca6'], tint: 'rgba(255,170,80,0.07)', fireflies: false,
  },
  senja: {
    sky: ['#3a2f66', '#b8628a', '#ffa25e'], sun: '#ffe2a0', sunGlow: '255,170,100', sunX: 250, sunY: 140, sunR: 22,
    mountain: ['#7c5a8c', '#5e4478'], haze: '255,150,120', smoke: '#d8a8b4',
    hills: ['#5a4a72', '#40365c'], tree: ['#3a3054', '#2a2240'], field: ['#6a5468', '#54425a'],
    wall: '#7a5248', roof: '#3e2a32', window: '#ffc86a', cloud: ['#ffc6a0', '#c88094'], tint: 'rgba(120,60,140,0.08)', fireflies: true,
  },
};

const SCALE = 2;
const LAYER_W = 512;

interface Layers {
  theme: Theme;
  sky: HTMLCanvasElement;
  mountains: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  near: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  clouds: { img: HTMLCanvasElement; x: number; y: number; speed: number }[];
}

const cache = new Map<ThemeName, Layers>();

/** Draws `fn` at x, and again one layer-width either side, so the layer tiles seamlessly. */
function wrap(fn: (ox: number) => void): void {
  for (const ox of [-LAYER_W, 0, LAYER_W]) fn(ox);
}

function buildSky(th: Theme): HTMLCanvasElement {
  // Built at the widest view so it covers any screen shape.
  const [c, ctx] = hiCanvas(MAX_VIEW_W, VIEW_H, SCALE);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(0.55, th.sky[1]);
  g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MAX_VIEW_W, VIEW_H);
  ctx.fillStyle = rgrad(ctx, th.sunX, th.sunY, th.sunR * 6, [
    [0, `rgba(${th.sunGlow},0.55)`],
    [0.25, `rgba(${th.sunGlow},0.25)`],
    [1, `rgba(${th.sunGlow},0)`],
  ]);
  ctx.fillRect(0, 0, MAX_VIEW_W, VIEW_H);
  circle(ctx, th.sunX, th.sunY, th.sunR);
  ctx.fillStyle = th.sun;
  ctx.fill();
  return c;
}

function buildMountains(th: Theme): HTMLCanvasElement {
  const [c, ctx] = hiCanvas(LAYER_W, VIEW_H, SCALE);
  const base = 152;
  const peaks = [
    { x: 90, h: 100, s: 0.62 },
    { x: 270, h: 70, s: 0.78 },
    { x: 410, h: 118, s: 0.55 },
  ];
  const height = (x: number) => {
    let best = 16;
    for (const p of peaks) {
      for (const k of [-1, 0, 1]) {
        const d = Math.abs(x - (p.x + k * LAYER_W));
        // Soften the peak into a rounded crater top.
        const h = p.h - d * p.s - Math.max(0, 8 - d) ** 2 * 0.06;
        best = Math.max(best, h);
      }
    }
    return base - best;
  };
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= LAYER_W; x += 2) ctx.lineTo(x, height(x));
  ctx.lineTo(LAYER_W, VIEW_H);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 30, base, th.mountain[0], th.mountain[1]);
  ctx.fill();
  // Atmospheric haze where the mountains meet the land.
  ctx.fillStyle = vgrad(ctx, base - 50, base + 10, `rgba(${th.haze},0)`, `rgba(${th.haze},0.75)`);
  ctx.fillRect(0, base - 50, LAYER_W, VIEW_H);
  ctx.fillStyle = th.smoke;
  ctx.globalAlpha = 0.65;
  for (const [dx, dy, r] of [[0, -4, 4], [5, -9, 5], [12, -14, 6], [21, -17, 5.5]]) {
    circle(ctx, 410 + dx, base - 116 + dy, r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function drawPalm(ctx: Ctx, x: number, ground: number, h: number, colors: [string, string]): void {
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, ground);
  ctx.quadraticCurveTo(x + 2, ground - h * 0.5, x + 5, ground - h);
  ctx.stroke();
  const tx = x + 5;
  const ty = ground - h;
  for (const [a, len] of [[-2.6, 12], [-2.1, 13], [-1.2, 11], [-0.5, 13], [-0.05, 12], [-3.1, 10]]) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ellipse(ctx, len / 2, 0, len / 2, 1.8, 0.15);
    paint(ctx, colors[0]);
    ctx.restore();
  }
  circle(ctx, tx, ty + 0.5, 1.6);
  ctx.fillStyle = '#6a4a2a';
  ctx.fill();
}

function drawRoundTree(ctx: Ctx, x: number, ground: number, size: number, colors: [string, string], r: () => number): void {
  roundRect(ctx, x - 0.9, ground - size * 0.9, 1.8, size * 0.9, 0.8);
  paint(ctx, '#7a5434');
  for (let k = 0; k < 5; k++) {
    const cx = x + (r() - 0.5) * size;
    const cy = ground - size * 1.2 + (r() - 0.5) * size * 0.6;
    const rad = size * (0.35 + r() * 0.2);
    circle(ctx, cx, cy, rad);
    ctx.fillStyle = vgrad(ctx, cy - rad, cy + rad, colors[0], colors[1]);
    ctx.fill();
  }
}

function buildHills(th: Theme): HTMLCanvasElement {
  const [c, ctx] = hiCanvas(LAYER_W, VIEW_H, SCALE);
  const base = 174;
  const heightAt = (x: number) =>
    base - (16 + 8 * Math.sin((x / LAYER_W) * Math.PI * 4) + 5 * Math.sin((x / LAYER_W) * Math.PI * 6 + 1.3));
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= LAYER_W; x += 2) ctx.lineTo(x, heightAt(x));
  ctx.lineTo(LAYER_W, VIEW_H);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, base - 30, base + 20, th.hills[0], th.hills[1]);
  ctx.fill();
  for (const [x, kind, s] of [[40, 0, 30], [62, 0, 24], [120, 1, 9], [170, 0, 34], [240, 1, 8], [330, 0, 28], [390, 1, 10], [452, 0, 32], [474, 0, 22]]) {
    wrap((ox) => {
      const gx = x + ox;
      if (kind === 0) drawPalm(ctx, gx, heightAt(x) + 2, s, th.tree);
      else drawRoundTree(ctx, gx, heightAt(x) + 2, s, th.tree, seeded(x));
    });
  }
  return c;
}

function drawHouse(ctx: Ctx, x: number, ground: number, th: Theme): void {
  // Rumah panggung on stilts with a steep thatched roof.
  ctx.fillStyle = th.roof;
  for (const sx of [2, 10, 18, 26]) {
    roundRect(ctx, x + sx, ground - 9, 1.8, 9, 0.6);
    ctx.fill();
  }
  roundRect(ctx, x - 1, ground - 10, 32, 2, 0.8);
  paint(ctx, th.roof);
  roundRect(ctx, x, ground - 24, 30, 14.5, 1);
  paint(ctx, vgrad(ctx, ground - 24, ground - 10, th.wall, th.roof));
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.4;
  for (let wx = x + 3; wx < x + 30; wx += 3) {
    ctx.beginPath();
    ctx.moveTo(wx, ground - 23.5);
    ctx.lineTo(wx, ground - 10.5);
    ctx.stroke();
  }
  for (const wx of [x + 5, x + 19]) {
    roundRect(ctx, wx, ground - 20, 6, 6, 1);
    paint(ctx, th.window);
  }
  ctx.beginPath();
  ctx.moveTo(x - 6, ground - 23);
  ctx.quadraticCurveTo(x + 15, ground - 30, x + 15, ground - 40);
  ctx.quadraticCurveTo(x + 15, ground - 30, x + 36, ground - 23);
  ctx.closePath();
  paint(ctx, vgrad(ctx, ground - 40, ground - 23, th.roof, th.roof));
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - 4, ground - 23.5);
  ctx.quadraticCurveTo(x + 13, ground - 29, x + 14.6, ground - 38);
  ctx.stroke();
  // Crossed gable horns.
  ctx.strokeStyle = th.roof;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 12.5, ground - 43);
  ctx.lineTo(x + 16.5, ground - 38);
  ctx.moveTo(x + 17.5, ground - 43);
  ctx.lineTo(x + 13.5, ground - 38);
  ctx.stroke();
}

function buildNear(th: Theme): HTMLCanvasElement {
  const [c, ctx] = hiCanvas(LAYER_W, VIEW_H, SCALE);
  const base = 190;
  // Terraced rice fields with curved dikes.
  for (let i = 0; i < 4; i++) {
    const y = base + i * 7;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= LAYER_W; x += 4) ctx.lineTo(x, y + Math.sin((x / LAYER_W) * Math.PI * 4 + i) * 1.5);
    ctx.lineTo(LAYER_W, VIEW_H);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, y, y + 8, th.field[0], th.field[1]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  wrap((ox) => {
    drawHouse(ctx, 120 + ox, base, th);
    drawHouse(ctx, 380 + ox, base, th);
    for (const tx of [60, 240, 300, 460]) drawRoundTree(ctx, tx + ox, base, 12, th.tree, seeded(tx));
  });
  return c;
}

function buildCloud(th: Theme, seed: number): HTMLCanvasElement {
  const [c, ctx] = hiCanvas(70, 28, SCALE);
  const r = seeded(seed);
  const puffs = Array.from({ length: 6 }, (_, i) => ({ x: 12 + i * 9 + r() * 4, y: 17 - r() * 6 - (i > 1 && i < 4 ? 3 : 0), rad: 6 + r() * 4 }));
  for (const p of puffs) {
    circle(ctx, p.x, p.y, p.rad);
    ctx.fillStyle = vgrad(ctx, p.y - p.rad, p.y + p.rad, th.cloud[0], th.cloud[1]);
    ctx.fill();
  }
  return c;
}

function buildVignette(): HTMLCanvasElement {
  // Stretched to the current view width when drawn.
  const [c, ctx] = hiCanvas(BASE_VIEW_W, VIEW_H, 1);
  const g = ctx.createRadialGradient(BASE_VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, BASE_VIEW_W / 2, VIEW_H / 2, BASE_VIEW_W * 0.62);
  g.addColorStop(0, 'rgba(40,20,10,0)');
  g.addColorStop(1, 'rgba(40,20,10,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BASE_VIEW_W, VIEW_H);
  return c;
}

function layers(name: ThemeName): Layers {
  let l = cache.get(name);
  if (!l) {
    const th = THEMES[name];
    l = {
      theme: th,
      sky: buildSky(th),
      mountains: buildMountains(th),
      hills: buildHills(th),
      near: buildNear(th),
      vignette: buildVignette(),
      clouds: [0, 1, 2, 3, 4].map((i) => ({ img: buildCloud(th, i + 3), x: i * 150 + (i % 2) * 40, y: 10 + ((i * 37) % 60), speed: 2 + (i % 3) })),
    };
    cache.set(name, l);
  }
  return l;
}

function tiled(ctx: Ctx, img: HTMLCanvasElement, offset: number, y: number): void {
  let x = -(((offset % LAYER_W) + LAYER_W) % LAYER_W);
  for (; x < VIEW_W; x += LAYER_W) ctx.drawImage(img, x, y, LAYER_W, VIEW_H);
}

const fireflies = Array.from({ length: 22 }, (_, i) => {
  const r = seeded(100 + i);
  return { x: r() * 600, y: 60 + r() * 130, phase: r() * 10, speed: 0.4 + r() * 0.6 };
});

export function drawBackground(ctx: Ctx, name: ThemeName, camX: number, camY: number, time: number): void {
  const l = layers(name);
  ctx.drawImage(l.sky, 0, 0, MAX_VIEW_W, VIEW_H);
  const span = LAYER_W + 140;
  for (const cl of l.clouds) {
    let x = (cl.x - camX * 0.06 - time * cl.speed) % span;
    if (x < -70) x += span;
    ctx.drawImage(cl.img, x, cl.y, 70, 28);
  }
  tiled(ctx, l.mountains, camX * 0.12, -camY * 0.1);
  tiled(ctx, l.hills, camX * 0.3, -camY * 0.25);
  tiled(ctx, l.near, camX * 0.55, -camY * 0.4);
}

/** Drawn after the world: colour grading, vignette and (at dusk) glowing fireflies. */
export function drawAtmosphere(ctx: Ctx, name: ThemeName, camX: number, camY: number, time: number): void {
  const l = layers(name);
  if (l.theme.tint) {
    ctx.fillStyle = l.theme.tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (l.theme.fireflies) {
    for (const f of fireflies) {
      const x = (((f.x + Math.sin(time * f.speed + f.phase) * 20 - camX * 0.7) % 600) + 600) % 600 - 100;
      const y = f.y + Math.cos(time * f.speed * 1.3 + f.phase) * 10 - camY * 0.5;
      const glow = (Math.sin(time * 2.5 + f.phase * 3) + 1) / 2;
      ctx.fillStyle = rgrad(ctx, x, y, 5, [[0, `rgba(255,246,160,${0.6 * glow})`], [1, 'rgba(255,246,160,0)']]);
      circle(ctx, x, y, 5);
      ctx.fill();
      circle(ctx, x, y, 0.7);
      ctx.fillStyle = `rgba(255,255,220,${0.5 + glow * 0.5})`;
      ctx.fill();
    }
  }
  ctx.drawImage(l.vignette, 0, 0, VIEW_W, VIEW_H);
}
