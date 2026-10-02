import { makeCanvas, seeded } from '../engine/pixel';
import { MAX_VIEW_W, VIEW_H, VIEW_W } from './constants';

export type ThemeName = 'pagi' | 'siang' | 'sore' | 'senja';

interface Theme {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  sunX: number;
  sunY: number;
  sunR: number;
  mountain: string;
  mountainShade: string;
  smoke: string;
  hills: string;
  hillsDark: string;
  field: string;
  fieldLine: string;
  house: string;
  roof: string;
  cloud: string;
  cloudShade: string;
  fireflies: boolean;
}

const THEMES: Record<ThemeName, Theme> = {
  pagi: {
    skyTop: '#6fb7e8', skyBottom: '#fbe6b8', sun: '#fff4c2', sunGlow: '#ffe9a8', sunX: 300, sunY: 52, sunR: 13,
    mountain: '#93abc6', mountainShade: '#7f97b6', smoke: '#e8eef4',
    hills: '#6e9f5c', hillsDark: '#4b7543', field: '#86b852', fieldLine: '#b0d878',
    house: '#6b4a33', roof: '#4a2f22', cloud: '#ffffff', cloudShade: '#dbe9f5', fireflies: false,
  },
  siang: {
    skyTop: '#3d95dc', skyBottom: '#c4ecf8', sun: '#fffbe6', sunGlow: '#fff3b8', sunX: 70, sunY: 30, sunR: 12,
    mountain: '#7fa0c4', mountainShade: '#6a8bb2', smoke: '#f2f5f8',
    hills: '#5c9a4a', hillsDark: '#3f7238', field: '#7ab648', fieldLine: '#a8dc6e',
    house: '#6e4b30', roof: '#3f281c', cloud: '#ffffff', cloudShade: '#d4e6f4', fireflies: false,
  },
  sore: {
    skyTop: '#4f86c9', skyBottom: '#ffd29a', sun: '#fff0b8', sunGlow: '#ffc978', sunX: 96, sunY: 96, sunR: 16,
    mountain: '#7c8fb4', mountainShade: '#68799e', smoke: '#f4e2d0',
    hills: '#5f8c4a', hillsDark: '#3f6236', field: '#88a948', fieldLine: '#c2c56a',
    house: '#5e3f2a', roof: '#3b241a', cloud: '#fff4e0', cloudShade: '#f0c9a0', fireflies: false,
  },
  senja: {
    skyTop: '#33275a', skyBottom: '#f39253', sun: '#ffd27a', sunGlow: '#ffb466', sunX: 250, sunY: 140, sunR: 22,
    mountain: '#5c4170', mountainShade: '#4a3360', smoke: '#c99aa0',
    hills: '#41355a', hillsDark: '#2b2342', field: '#4f3d55', fieldLine: '#6e5466',
    house: '#2a1f33', roof: '#1c1424', cloud: '#f7b48a', cloudShade: '#c27c84', fireflies: true,
  },
};

const LAYER_W = 512;

interface Layers {
  theme: Theme;
  sky: HTMLCanvasElement;
  mountains: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  near: HTMLCanvasElement;
  clouds: { img: HTMLCanvasElement; x: number; y: number }[];
}

const cache = new Map<ThemeName, Layers>();

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function buildSky(th: Theme): HTMLCanvasElement {
  // Built at the widest view so it covers any screen shape.
  const [c, ctx] = makeCanvas(MAX_VIEW_W, VIEW_H);
  // Stepped bands instead of a smooth gradient for a retro look.
  const band = 6;
  for (let y = 0; y < VIEW_H; y += band) {
    ctx.fillStyle = mix(th.skyTop, th.skyBottom, Math.min(1, y / (VIEW_H * 0.8)));
    ctx.fillRect(0, y, MAX_VIEW_W, band);
  }
  const disc = (r: number, color: string) => {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(th.sunX - w, th.sunY + dy, w * 2 + 1, 1);
    }
  };
  ctx.globalAlpha = 0.25;
  disc(th.sunR + 10, th.sunGlow);
  ctx.globalAlpha = 0.45;
  disc(th.sunR + 4, th.sunGlow);
  ctx.globalAlpha = 1;
  disc(th.sunR, th.sun);
  return c;
}

function buildMountains(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(LAYER_W, VIEW_H);
  const base = 150;
  const peaks = [
    { x: 90, h: 105, s: 0.62 },
    { x: 270, h: 72, s: 0.75 },
    { x: 410, h: 122, s: 0.55 },
  ];
  for (let x = 0; x < LAYER_W; x++) {
    let best = 18;
    let shade = false;
    for (const p of peaks) {
      for (const k of [-1, 0, 1]) {
        const px = p.x + k * LAYER_W;
        // Flat crater tops make them read as volcanoes.
        const h = Math.min(p.h - 4, p.h - Math.abs(x - px) * p.s);
        if (h > best) {
          best = h;
          shade = x > px;
        }
      }
    }
    const top = Math.round(base - best);
    ctx.fillStyle = shade ? th.mountainShade : th.mountain;
    ctx.fillRect(x, top, 1, VIEW_H - top);
  }
  // Smoke puffs above the tallest crater.
  ctx.fillStyle = th.smoke;
  ctx.globalAlpha = 0.7;
  for (const [dx, dy, r] of [[0, -6, 4], [5, -11, 5], [12, -16, 6], [20, -19, 5]]) {
    for (let yy = -r; yy <= r; yy++) {
      const w = Math.floor(Math.sqrt(r * r - yy * yy));
      ctx.fillRect(410 + dx - w, base - 118 + dy + yy, w * 2 + 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, color: string): void {
  ctx.fillStyle = color;
  // Slightly curved trunk.
  for (let i = 0; i < h; i++) {
    const bend = Math.round(Math.sin((i / h) * 1.4) * 4);
    ctx.fillRect(x + bend, groundY - i, 2, 1);
  }
  const tx = x + Math.round(Math.sin(1.4) * 4);
  const ty = groundY - h;
  // Fronds droop outwards from the crown.
  for (const dir of [-1, 1]) {
    for (const len of [10, 13]) {
      for (let i = 0; i < len; i++) {
        const droop = Math.round((i * i) / (len === 13 ? 22 : 12));
        ctx.fillRect(tx + dir * i, ty + droop - (len === 13 ? 2 : 0), 1, 2);
      }
    }
  }
  ctx.fillRect(tx - 1, ty - 4, 2, 4);
}

function buildHills(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(LAYER_W, VIEW_H);
  const base = 172;
  const heightAt = (x: number) =>
    base - (16 + 8 * Math.sin((x / LAYER_W) * Math.PI * 4) + 5 * Math.sin((x / LAYER_W) * Math.PI * 6 + 1.3));
  ctx.fillStyle = th.hills;
  for (let x = 0; x < LAYER_W; x++) {
    const top = Math.round(heightAt(x));
    ctx.fillRect(x, top, 1, VIEW_H - top);
  }
  for (const [x, h] of [[40, 30], [58, 24], [170, 34], [330, 28], [452, 32], [470, 22]]) {
    drawPalm(ctx, x, Math.round(heightAt(x)) + 2, h, th.hillsDark);
  }
  return c;
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, groundY: number, th: Theme): void {
  // Rumah panggung: raised on stilts with a steep roof.
  ctx.fillStyle = th.house;
  for (const sx of [2, 10, 18, 26]) ctx.fillRect(x + sx, groundY - 8, 2, 8);
  ctx.fillRect(x, groundY - 22, 30, 14);
  ctx.fillStyle = th.roof;
  for (let i = 0; i < 12; i++) ctx.fillRect(x - 4 + i, groundY - 22 - i, 38 - i * 2, 1);
  // Crossed gable tips.
  ctx.fillRect(x + 10, groundY - 37, 2, 4);
  ctx.fillRect(x + 18, groundY - 37, 2, 4);
  ctx.fillStyle = th.field;
  ctx.fillRect(x + 6, groundY - 18, 5, 5);
  ctx.fillRect(x + 19, groundY - 18, 5, 5);
  // Ladder.
  ctx.fillStyle = th.roof;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 12, groundY - 2 - i * 2, 6, 1);
}

function buildNear(th: Theme): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(LAYER_W, VIEW_H);
  const base = 188;
  // Terraced rice fields.
  for (let i = 0; i < 4; i++) {
    const y = base + i * 7;
    ctx.fillStyle = th.field;
    ctx.fillRect(0, y, LAYER_W, VIEW_H - y);
    ctx.fillStyle = th.fieldLine;
    for (let x = (i * 13) % 9; x < LAYER_W; x += 9) ctx.fillRect(x, y + 2, 1, 2);
    ctx.fillRect(0, y, LAYER_W, 1);
  }
  drawHouse(ctx, 120, base, th);
  drawHouse(ctx, 380, base, th);
  // Round fruit trees.
  const r = seeded(7);
  for (const tx of [60, 240, 300, 460]) {
    ctx.fillStyle = th.house;
    ctx.fillRect(tx, base - 10, 2, 10);
    ctx.fillStyle = th.hillsDark;
    for (let k = 0; k < 5; k++) {
      const cx = tx + Math.round((r() - 0.5) * 10);
      const cy = base - 14 + Math.round((r() - 0.5) * 6);
      const rad = 4 + Math.floor(r() * 3);
      for (let yy = -rad; yy <= rad; yy++) {
        const w = Math.floor(Math.sqrt(rad * rad - yy * yy));
        ctx.fillRect(cx - w, cy + yy, w * 2 + 1, 1);
      }
    }
  }
  return c;
}

function buildCloud(th: Theme, seed: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 20);
  const r = seeded(seed);
  const blobs = Array.from({ length: 5 }, (_, i) => ({ x: 10 + i * 9 + r() * 4, y: 12 - r() * 5, rad: 5 + r() * 4 }));
  for (const [color, dy] of [[th.cloudShade, 2], [th.cloud, 0]] as const) {
    ctx.fillStyle = color;
    for (const b of blobs) {
      const rad = Math.floor(b.rad);
      for (let yy = -rad; yy <= rad; yy++) {
        const w = Math.floor(Math.sqrt(rad * rad - yy * yy));
        ctx.fillRect(Math.round(b.x) - w, Math.round(b.y) + yy + dy, w * 2 + 1, 1);
      }
    }
  }
  ctx.clearRect(0, 18, 56, 2);
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
      clouds: [0, 1, 2, 3, 4].map((i) => ({ img: buildCloud(th, i + 3), x: i * 160 + (i % 2) * 40, y: 14 + ((i * 37) % 60) })),
    };
    cache.set(name, l);
  }
  return l;
}

function tiled(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, offset: number, y: number): void {
  let x = -(((offset % img.width) + img.width) % img.width);
  for (; x < VIEW_W; x += img.width) ctx.drawImage(img, Math.round(x), Math.round(y));
}

const fireflies = Array.from({ length: 22 }, (_, i) => {
  const r = seeded(100 + i);
  return { x: r() * 600, y: 60 + r() * 130, phase: r() * 10, speed: 0.4 + r() * 0.6 };
});

export function drawBackground(ctx: CanvasRenderingContext2D, name: ThemeName, camX: number, camY: number, time: number): void {
  const l = layers(name);
  ctx.drawImage(l.sky, 0, 0);
  const span = LAYER_W + 120;
  for (const cl of l.clouds) {
    let x = (cl.x - camX * 0.06 - time * 3) % span;
    if (x < -60) x += span;
    ctx.drawImage(cl.img, Math.round(x), cl.y);
  }
  tiled(ctx, l.mountains, camX * 0.12, -camY * 0.1);
  tiled(ctx, l.hills, camX * 0.3, -camY * 0.25);
  tiled(ctx, l.near, camX * 0.55, -camY * 0.4);

  if (l.theme.fireflies) {
    for (const f of fireflies) {
      const x = (((f.x + Math.sin(time * f.speed + f.phase) * 20 - camX * 0.7) % 600) + 600) % 600 - 100;
      const y = f.y + Math.cos(time * f.speed * 1.3 + f.phase) * 10 - camY * 0.5;
      const glow = (Math.sin(time * 2.5 + f.phase * 3) + 1) / 2;
      ctx.globalAlpha = 0.25 * glow;
      ctx.fillStyle = '#fff6a0';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      ctx.globalAlpha = 0.5 + glow * 0.5;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
