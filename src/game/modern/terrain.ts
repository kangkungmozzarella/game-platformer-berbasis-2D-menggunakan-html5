import { seeded } from '../../engine/pixel';
import type { ThemeName } from '../background';
import { TILE } from '../constants';
import type { Level } from '../level';
import { circle, ellipse, hiCanvas, paint, roundRect, vgrad, type Ctx } from './draw';

/** Terrain is pre-rendered at this multiple of the logical resolution. */
const SCALE = 3;
/** Wide levels are split into chunks to stay under mobile canvas size limits. */
const CHUNK = 256;
const T = TILE;

interface Palette {
  grassTop: string;
  grass: string;
  grassDark: string;
  dirt: [string, string, string, string];
  stoneTop: string;
  stone: string;
  mortar: string;
  moss: string;
}

const BASE: Palette = {
  grassTop: '#a8e57c',
  grass: '#6cc052',
  grassDark: '#4c9a40',
  dirt: ['#c48b5c', '#ad754b', '#98633d', '#855533'],
  stoneTop: '#cfc8bc',
  stone: '#a59e93',
  mortar: '#7e776d',
  moss: '#86b85c',
};

const PALETTES: Record<ThemeName, Palette> = {
  pagi: BASE,
  siang: BASE,
  sore: { ...BASE, grassTop: '#c2e07a', grass: '#7cb850', grassDark: '#589840' },
  senja: {
    ...BASE,
    grassTop: '#9cc77a',
    grass: '#5e9a52',
    grassDark: '#447a44',
    dirt: ['#a8775a', '#93644b', '#7e553f', '#6c4836'],
    stoneTop: '#b8aeb0',
    stone: '#8e8488',
    mortar: '#685f66',
    moss: '#6e9a5c',
  },
};

export interface WaterSurface {
  x0: number;
  x1: number;
  y: number;
}

export interface Terrain {
  chunks: { x: number; canvas: HTMLCanvasElement }[];
  water: WaterSurface[];
}

// ------------------------------------------------------------ tiles

function depthBelowSurface(lvl: Level, cx: number, cy: number): number {
  let d = 0;
  while (d < 3 && lvl.isSolid(cx, cy - d - 1)) d++;
  return d;
}

function solidShape(ctx: Ctx, lvl: Level, cx: number, cy: number): void {
  const x = cx * T;
  const y = cy * T;
  const up = lvl.isSolid(cx, cy - 1);
  const down = cy + 1 >= lvl.rows || lvl.isSolid(cx, cy + 1);
  const left = lvl.isSolid(cx - 1, cy);
  const right = lvl.isSolid(cx + 1, cy);
  const R = 4;
  // Bleed slightly into solid neighbours so anti-aliased seams don't show.
  const e = 0.4;
  roundRect(
    ctx,
    x - (left ? e : 0),
    y - (up ? e : 0),
    T + (left ? e : 0) + (right ? e : 0),
    T + (up ? e : 0) + (down ? e : 0),
    [!up && !left ? R : 0, !up && !right ? R : 0, !down && !right ? R : 0, !down && !left ? R : 0],
  );
}

function drawDirt(ctx: Ctx, lvl: Level, cx: number, cy: number, pal: Palette, r: () => number): void {
  const x = cx * T;
  const y = cy * T;
  const d = depthBelowSurface(lvl, cx, cy);
  solidShape(ctx, lvl, cx, cy);
  ctx.fillStyle = vgrad(ctx, y, y + T, pal.dirt[d], pal.dirt[Math.min(3, d + 1)]);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    if (r() < 0.45) continue;
    const px = x + 2 + r() * 12;
    const py = y + 4 + r() * 10;
    const w = 1 + r() * 1.4;
    ellipse(ctx, px, py, w, w * 0.7);
    paint(ctx, 'rgba(70,40,20,0.25)');
    ellipse(ctx, px - 0.3, py - 0.3, w * 0.6, w * 0.35);
    paint(ctx, 'rgba(255,230,200,0.25)');
  }
}

function drawStone(ctx: Ctx, lvl: Level, cx: number, cy: number, pal: Palette, r: () => number): void {
  const x = cx * T;
  const y = cy * T;
  ctx.save();
  solidShape(ctx, lvl, cx, cy);
  ctx.fillStyle = pal.mortar;
  ctx.fill();
  ctx.clip();
  // Brick rows are aligned to the whole level so neighbouring tiles line up.
  for (const [row, by] of [[cy * 2, y], [cy * 2 + 1, y + 8]] as const) {
    const off = row % 2 === 0 ? 0 : 6;
    for (let bx = Math.floor((x - off) / 12) * 12 + off - 12; bx < x + T; bx += 12) {
      roundRect(ctx, bx + 0.5, by + 0.5, 11, 7, 1.6);
      ctx.fillStyle = vgrad(ctx, by, by + 8, pal.stoneTop, pal.stone);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bx + 1.6, by + 1.1, 8.8, 0.6);
    }
  }
  if (r() < 0.25) {
    ctx.strokeStyle = 'rgba(70,60,55,0.4)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    const sx = x + 3 + r() * 9;
    ctx.moveTo(sx, y + 2);
    ctx.lineTo(sx + 1.2, y + 5);
    ctx.lineTo(sx + 0.4, y + 7);
    ctx.stroke();
  }
  ctx.restore();
  if (!lvl.isSolid(cx, cy - 1)) {
    // Moss hugging the top edge, with a drip or two.
    ctx.fillStyle = pal.moss;
    for (let i = 0; i < 6; i++) {
      circle(ctx, x + 1.5 + i * 2.6 + r(), y + 0.6, 1.2 + r() * 0.8);
      ctx.fill();
    }
    if (r() < 0.5) {
      roundRect(ctx, x + 4 + r() * 8, y, 1.2, 3 + r() * 2, 0.6);
      ctx.fill();
    }
  }
}

/** Wavy lower edge of the grass, continuous across tiles because it depends only on world x. */
function grassEdge(px: number, y: number): number {
  return y + 4.4 + Math.sin(px * 0.8) * 0.8 + Math.sin(px * 2.3) * 0.4;
}

function drawGrass(ctx: Ctx, lvl: Level, cx: number, cy: number, pal: Palette, r: () => number): void {
  const x = cx * T;
  const y = cy * T;
  const leftCont = lvl.isSolid(cx - 1, cy) && !lvl.isSolid(cx - 1, cy - 1);
  const rightCont = lvl.isSolid(cx + 1, cy) && !lvl.isSolid(cx + 1, cy - 1);
  const x0 = x - (leftCont ? 0.5 : 1.2);
  const x1 = x + T + (rightCont ? 0.5 : 1.2);
  ctx.beginPath();
  if (leftCont) ctx.moveTo(x0, y - 0.8);
  else {
    ctx.moveTo(x0, y + 2.5);
    ctx.quadraticCurveTo(x0, y - 0.8, x0 + 2.4, y - 0.8);
  }
  if (rightCont) ctx.lineTo(x1, y - 0.8);
  else {
    ctx.lineTo(x1 - 2.4, y - 0.8);
    ctx.quadraticCurveTo(x1, y - 0.8, x1, y + 2.5);
  }
  for (let px = x1; px >= x0; px -= 1.5) ctx.lineTo(px, grassEdge(px, y));
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, y - 1, y + 5, pal.grassTop, pal.grassDark);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x0 + (leftCont ? 0 : 2), y - 0.4);
  ctx.lineTo(x1 - (rightCont ? 0 : 2), y - 0.4);
  ctx.stroke();

  // Blades of grass and the odd flower.
  ctx.strokeStyle = pal.grass;
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    if (r() < 0.4) continue;
    const bx = x + 1 + r() * 14;
    const h = 1.6 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + 0.3, y - h * 0.6, bx + (r() - 0.5) * 1.6, y - h);
    ctx.stroke();
  }
  if (r() < 0.22) {
    const fx = x + 3 + r() * 10;
    const color = ['#ffffff', '#ffd45a', '#ff8f9a', '#c6a2ff'][Math.floor(r() * 4)];
    ctx.strokeStyle = pal.grassDark;
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx, y - 3);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      circle(ctx, fx + Math.cos(a) * 0.9, y - 3.6 + Math.sin(a) * 0.9, 0.75);
      ctx.fill();
    }
    ctx.fillStyle = '#f2a33a';
    circle(ctx, fx, y - 3.6, 0.5);
    ctx.fill();
  }
}

function drawBambooRun(ctx: Ctx, x0: number, x1: number, y: number): void {
  roundRect(ctx, x0 + 0.3, y + 0.4, x1 - x0 - 0.6, 4.8, 2.4);
  paint(ctx, vgrad(ctx, y, y + 5.2, '#f3e08e', '#b8963a'), '#8a6e28', 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(x0 + 2, y + 1.2, x1 - x0 - 4, 0.6);
  for (let nx = x0 + 7.5; nx < x1 - 2; nx += 8) {
    roundRect(ctx, nx - 0.5, y + 0.3, 1, 5, 0.5);
    paint(ctx, '#9a7c30');
  }
  // Rope lashing hanging below.
  ctx.strokeStyle = '#6a4a2a';
  ctx.lineWidth = 0.8;
  for (let lx = x0 + 3; lx < x1; lx += 9) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 4.8);
    ctx.quadraticCurveTo(lx + 0.6, y + 6.4, lx + 0.2, y + 7.2);
    ctx.stroke();
  }
}

function drawStakes(ctx: Ctx, cx: number, cy: number, r: () => number): void {
  const x = cx * T;
  const bottom = (cy + 1) * T;
  for (const sx of [2.5, 7.5, 12.5]) {
    const h = 9 + r() * 3.5;
    const top = bottom - h;
    ctx.beginPath();
    ctx.moveTo(x + sx - 1.8, bottom);
    ctx.lineTo(x + sx - 1.8, top + 3);
    ctx.lineTo(x + sx + 1.8, top);
    ctx.lineTo(x + sx + 1.8, bottom);
    ctx.closePath();
    const g = ctx.createLinearGradient(x + sx - 1.8, 0, x + sx + 1.8, 0);
    g.addColorStop(0, '#e4d986');
    g.addColorStop(1, '#9a8a38');
    paint(ctx, g, '#6e6224', 0.45);
    // Fresh-cut face of the stake.
    ctx.beginPath();
    ctx.moveTo(x + sx - 1.8, top + 3);
    ctx.lineTo(x + sx + 1.8, top);
    ctx.lineTo(x + sx + 1.2, top + 2.6);
    ctx.closePath();
    paint(ctx, '#f6f0c4');
    roundRect(ctx, x + sx - 2, bottom - 4.2, 4, 1, 0.5);
    paint(ctx, '#8a7a30');
  }
}

function drawFence(ctx: Ctx, cx: number, cy: number): void {
  const x = cx * T;
  const bottom = (cy + 1) * T;
  for (const ry of [bottom - 9.5, bottom - 5]) {
    roundRect(ctx, x - 0.5, ry, T + 1, 1.8, 0.9);
    paint(ctx, '#c4a454', '#8a7030', 0.35);
  }
  for (const px of [3, 11]) {
    roundRect(ctx, x + px, bottom - 12.5, 2.6, 12.5, [1.3, 1.3, 0, 0]);
    paint(ctx, vgrad(ctx, bottom - 12, bottom, '#e8d080', '#b0903c'), '#8a7030', 0.4);
  }
}

function drawPadi(ctx: Ctx, cx: number, cy: number, r: () => number): void {
  const x = cx * T;
  const bottom = (cy + 1) * T;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const sx = x + 1.5 + i * 2.6 + r();
    const h = 7 + r() * 5;
    const bend = 1.5 + r() * 1.5;
    ctx.strokeStyle = '#6fa848';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx, bottom);
    ctx.quadraticCurveTo(sx, bottom - h, sx + bend, bottom - h + 1.5);
    ctx.stroke();
    // Golden grain drooping from the tip.
    ctx.fillStyle = '#ecc85a';
    for (let k = 0; k < 3; k++) {
      ellipse(ctx, sx + bend + 0.3 + k * 0.3, bottom - h + 2 + k * 1.1, 0.55, 0.8, 0.4);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------ assembly

function drawRange(ctx: Ctx, lvl: Level, pal: Palette, c0: number, c1: number): void {
  const tileRand = (cx: number, cy: number, salt: number) => seeded(cx * 7919 + cy * 104729 + salt);
  const each = (fn: (cx: number, cy: number, t: string) => void) => {
    for (let cy = 0; cy < lvl.rows; cy++) for (let cx = c0; cx <= c1; cx++) fn(cx, cy, lvl.tile(cx, cy));
  };
  each((cx, cy, t) => {
    if (t === 'f') drawFence(ctx, cx, cy);
    else if (t === 'y') drawPadi(ctx, cx, cy, tileRand(cx, cy, 1));
  });
  // Bamboo rafts are drawn as whole runs so they read as one long pole.
  for (let cy = 0; cy < lvl.rows; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      if (lvl.tile(cx, cy) !== '=' || (lvl.tile(cx - 1, cy) === '=' && cx !== c0)) continue;
      let end = cx;
      while (lvl.tile(end + 1, cy) === '=') end++;
      let start = cx;
      while (lvl.tile(start - 1, cy) === '=') start--;
      drawBambooRun(ctx, start * T, (end + 1) * T, cy * T);
    }
  }
  each((cx, cy, t) => {
    if (t === '^') drawStakes(ctx, cx, cy, tileRand(cx, cy, 2));
    else if (t === '#') drawDirt(ctx, lvl, cx, cy, pal, tileRand(cx, cy, 3));
    else if (t === 'B') drawStone(ctx, lvl, cx, cy, pal, tileRand(cx, cy, 4));
  });
  each((cx, cy, t) => {
    if (t === '#' && !lvl.isSolid(cx, cy - 1)) drawGrass(ctx, lvl, cx, cy, pal, tileRand(cx, cy, 5));
  });
}

export function renderTerrain(lvl: Level, theme: ThemeName): Terrain {
  const pal = PALETTES[theme];
  const chunks: Terrain['chunks'] = [];
  for (let x = 0; x < lvl.width; x += CHUNK) {
    const w = Math.min(CHUNK, lvl.width - x);
    const [canvas, ctx] = hiCanvas(w, lvl.height, SCALE);
    ctx.translate(-x, 0);
    // Include one tile either side so shapes crossing a chunk edge are complete.
    drawRange(ctx, lvl, pal, Math.floor(x / T) - 1, Math.ceil((x + w) / T));
    chunks.push({ x, canvas });
  }
  const water: WaterSurface[] = [];
  for (let cy = 0; cy < lvl.rows; cy++) {
    for (let cx = 0; cx < lvl.cols; cx++) {
      if (lvl.tile(cx, cy) !== '~' || lvl.tile(cx, cy - 1) === '~' || lvl.tile(cx - 1, cy) === '~') continue;
      let end = cx;
      while (lvl.tile(end + 1, cy) === '~') end++;
      water.push({ x0: cx * T, x1: (end + 1) * T, y: cy * T });
    }
  }
  return { chunks, water };
}

export function drawTerrain(ctx: Ctx, terrain: Terrain, camX: number, camY: number, viewW: number): void {
  for (const ch of terrain.chunks) {
    const w = ch.canvas.width / SCALE;
    if (ch.x + w < camX || ch.x > camX + viewW) continue;
    ctx.drawImage(ch.canvas, ch.x - camX, -camY, w, ch.canvas.height / SCALE);
  }
}

export function drawWater(ctx: Ctx, terrain: Terrain, camX: number, camY: number, viewW: number, viewH: number, time: number): void {
  for (const s of terrain.water) {
    if (s.x1 < camX || s.x0 > camX + viewW) continue;
    const x0 = Math.max(s.x0, camX - 2) - camX;
    const x1 = Math.min(s.x1, camX + viewW + 2) - camX;
    const sy = s.y + 3 - camY;
    const wave = (px: number) => sy + Math.sin(time * 2.6 + (px + camX) * 0.3) * 0.9 + Math.sin(time * 1.7 + (px + camX) * 0.11) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x0, viewH);
    for (let px = x0; px <= x1; px += 2) ctx.lineTo(px, wave(px));
    ctx.lineTo(x1, wave(x1));
    ctx.lineTo(x1, viewH);
    ctx.closePath();
    ctx.fillStyle = vgrad(ctx, sy, sy + 28, 'rgba(126,210,242,0.86)', 'rgba(36,104,168,0.96)');
    ctx.fill();
    ctx.beginPath();
    for (let px = x0; px <= x1; px += 2) ctx.lineTo(px, wave(px));
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Drifting glints on the surface.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let gx = Math.floor(s.x0 / 23) * 23; gx < s.x1; gx += 23) {
      const px = gx + ((time * 9 + gx * 0.7) % 23) - camX;
      if (px < x0 || px > x1) continue;
      ellipse(ctx, px, sy + 4 + ((gx / 23) % 3) * 2.5, 1.6, 0.35);
      ctx.fill();
    }
  }
}
