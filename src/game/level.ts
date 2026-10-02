import { makeCanvas, seeded } from '../engine/pixel';
import { MODERN } from './art';
import { TILE } from './constants';
import type { LevelDef } from './levels';

export interface Spawn {
  kind: 'player' | 'timun' | 'rambutan' | 'ketupat' | 'ayam' | 'lebah' | 'buaya' | 'buaya-swim' | 'checkpoint' | 'goal';
  cx: number;
  cy: number;
}

const SPAWN_CHARS: Record<string, Spawn['kind']> = {
  P: 'player',
  o: 'timun',
  r: 'rambutan',
  k: 'ketupat',
  a: 'ayam',
  l: 'lebah',
  b: 'buaya',
  v: 'buaya-swim',
  c: 'checkpoint',
  G: 'goal',
};

/** Static terrain of a level: collision queries plus a pre-rendered image of all non-animated tiles. */
export class Level {
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly spawns: Spawn[] = [];
  /** Pre-rendered pixel-art terrain; the modern style renders its own (see modern/terrain.ts). */
  readonly image: HTMLCanvasElement | null;
  private grid: string[][];

  constructor(def: LevelDef) {
    this.rows = def.map.length;
    this.cols = Math.max(...def.map.map((r) => r.length));
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.grid = def.map.map((row, cy) =>
      Array.from({ length: this.cols }, (_, cx) => {
        const ch = row[cx] ?? '.';
        const kind = SPAWN_CHARS[ch];
        if (kind) {
          this.spawns.push({ kind, cx, cy });
          return '.';
        }
        return ch;
      }),
    );
    this.image = MODERN ? null : renderTerrain(this);
  }

  tile(cx: number, cy: number): string {
    if (cy < 0 || cy >= this.rows || cx < 0 || cx >= this.cols) return '.';
    return this.grid[cy][cx];
  }

  /** The left and right edges of the map act as walls; the bottom is a bottomless pit. */
  isSolid(cx: number, cy: number): boolean {
    if (cx < 0 || cx >= this.cols) return true;
    const t = this.tile(cx, cy);
    return t === '#' || t === 'B';
  }

  isPlatform(cx: number, cy: number): boolean {
    return this.tile(cx, cy) === '=';
  }

  /** Whether something walking at this tile would have ground to stand on. */
  isFloor(cx: number, cy: number): boolean {
    return this.isSolid(cx, cy) || this.isPlatform(cx, cy);
  }
}

// ------------------------------------------------------------ tile art

const C = {
  dirt: '#7a4a2a',
  dirtDark: '#5e3820',
  dirtLight: '#94603a',
  dirtEdge: '#4a2c18',
  pebble: '#a08a74',
  grass: '#5aa83c',
  grassDark: '#3f8a2e',
  grassLight: '#8ad35a',
  stone: '#7d7872',
  stoneLight: '#9a958e',
  stoneDark: '#55514c',
  moss: '#5f8f3e',
  bamboo: '#c9b458',
  bambooLight: '#ebd98e',
  bambooDark: '#8f7d35',
  bambooNode: '#6e6028',
};

function drawGround(ctx: CanvasRenderingContext2D, lvl: Level, cx: number, cy: number, r: () => number): void {
  const x = cx * TILE;
  const y = cy * TILE;
  const up = lvl.isSolid(cx, cy - 1);
  ctx.fillStyle = C.dirt;
  ctx.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = r() < 0.5 ? C.dirtDark : C.dirtLight;
    ctx.fillRect(x + Math.floor(r() * 15), y + Math.floor(r() * 15), r() < 0.3 ? 2 : 1, 1);
  }
  if (r() < 0.25) {
    const px = x + 2 + Math.floor(r() * 10);
    const py = y + 6 + Math.floor(r() * 7);
    ctx.fillStyle = C.pebble;
    ctx.fillRect(px, py, 3, 2);
    ctx.fillStyle = C.dirtEdge;
    ctx.fillRect(px, py + 2, 3, 1);
  }
  if (!lvl.isSolid(cx - 1, cy) && cx > 0) {
    ctx.fillStyle = C.dirtEdge;
    ctx.fillRect(x, y, 1, TILE);
  }
  if (!lvl.isSolid(cx + 1, cy) && cx < lvl.cols - 1) {
    ctx.fillStyle = C.dirtEdge;
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
  }
  if (!up) {
    // Grass cap with a ragged lower edge.
    for (let i = 0; i < TILE; i++) {
      ctx.fillStyle = C.grassDark;
      ctx.fillRect(x + i, y, 1, 4 + Math.floor(r() * 3));
    }
    ctx.fillStyle = C.grass;
    ctx.fillRect(x, y, TILE, 3);
    ctx.fillStyle = C.grassLight;
    ctx.fillRect(x, y, TILE, 1);
    // Tufts and flowers poke into the empty tile above.
    if (r() < 0.45) {
      const tx = x + 1 + Math.floor(r() * 12);
      ctx.fillStyle = C.grass;
      ctx.fillRect(tx, y - 2, 1, 2);
      ctx.fillRect(tx + 2, y - 3, 1, 3);
      ctx.fillRect(tx + 4, y - 2, 1, 2);
    }
    if (r() < 0.2) {
      const fx = x + 2 + Math.floor(r() * 11);
      ctx.fillStyle = C.grassDark;
      ctx.fillRect(fx, y - 3, 1, 3);
      ctx.fillStyle = ['#f4f1e6', '#f2c94c', '#e86a5a'][Math.floor(r() * 3)];
      ctx.fillRect(fx - 1, y - 5, 3, 2);
    }
  }
}

function drawStone(ctx: CanvasRenderingContext2D, lvl: Level, cx: number, cy: number, r: () => number): void {
  const x = cx * TILE;
  const y = cy * TILE;
  ctx.fillStyle = C.stone;
  ctx.fillRect(x, y, TILE, TILE);
  // Offset blocks like temple masonry.
  const shift = cy % 2 === 0 ? 0 : 8;
  for (const [by, bh] of [[0, 8], [8, 8]]) {
    const off = by === 0 ? shift : 8 - shift;
    for (const bx of [off - 8, off, off + 8]) {
      const left = Math.max(bx, 0);
      const right = Math.min(bx + 8, TILE);
      if (right <= left) continue;
      ctx.fillStyle = C.stoneLight;
      ctx.fillRect(x + left, y + by, right - left, 1);
      if (bx >= 0) ctx.fillRect(x + left, y + by, 1, bh);
      ctx.fillStyle = C.stoneDark;
      ctx.fillRect(x + left, y + by + bh - 1, right - left, 1);
      if (bx + 8 <= TILE) ctx.fillRect(x + right - 1, y + by, 1, bh);
    }
  }
  if (r() < 0.3) {
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(x + 3 + Math.floor(r() * 9), y + 3 + Math.floor(r() * 9), 2, 1);
  }
  if (!lvl.isSolid(cx, cy - 1)) {
    ctx.fillStyle = C.moss;
    for (let i = 0; i < TILE; i++) if (r() < 0.6) ctx.fillRect(x + i, y, 1, 1 + Math.floor(r() * 2));
  }
}

function drawBamboo(ctx: CanvasRenderingContext2D, lvl: Level, cx: number, cy: number): void {
  const x = cx * TILE;
  const y = cy * TILE;
  const leftEnd = !lvl.isPlatform(cx - 1, cy);
  const rightEnd = !lvl.isPlatform(cx + 1, cy);
  const x0 = x + (leftEnd ? 1 : 0);
  const w = TILE - (leftEnd ? 1 : 0) - (rightEnd ? 1 : 0);
  ctx.fillStyle = C.bamboo;
  ctx.fillRect(x0, y, w, 5);
  ctx.fillStyle = C.bambooLight;
  ctx.fillRect(x0, y + 1, w, 1);
  ctx.fillStyle = C.bambooDark;
  ctx.fillRect(x0, y + 4, w, 1);
  ctx.fillStyle = C.bambooNode;
  ctx.fillRect(x + 7, y, 1, 5);
  if (leftEnd) ctx.fillRect(x0, y, 1, 5);
  if (rightEnd) ctx.fillRect(x0 + w - 1, y, 1, 5);
  // Rope lashing.
  ctx.fillStyle = '#5a3d22';
  ctx.fillRect(x + 3, y + 5, 1, 2);
  ctx.fillRect(x + 12, y + 5, 1, 2);
}

function drawStakes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: () => number): void {
  const x = cx * TILE;
  const bottom = (cy + 1) * TILE;
  for (const sx of [1, 6, 11]) {
    const h = 9 + Math.floor(r() * 4);
    const top = bottom - h;
    ctx.fillStyle = C.bambooDark;
    ctx.fillRect(x + sx, top + 2, 4, h - 2);
    ctx.fillStyle = C.bamboo;
    ctx.fillRect(x + sx + 1, top + 2, 2, h - 2);
    ctx.fillStyle = C.bambooLight;
    ctx.fillRect(x + sx + 1, top, 2, 2);
    ctx.fillRect(x + sx + 1, top - 1, 1, 1);
    ctx.fillStyle = C.bambooNode;
    ctx.fillRect(x + sx, bottom - 4, 4, 1);
  }
}

function drawFence(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const x = cx * TILE;
  const bottom = (cy + 1) * TILE;
  ctx.fillStyle = C.bambooDark;
  ctx.fillRect(x, bottom - 9, TILE, 2);
  ctx.fillRect(x, bottom - 5, TILE, 2);
  for (const px of [2, 10]) {
    ctx.fillStyle = C.bambooDark;
    ctx.fillRect(x + px, bottom - 12, 3, 12);
    ctx.fillStyle = C.bamboo;
    ctx.fillRect(x + px + 1, bottom - 12, 1, 12);
  }
}

function drawPadi(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: () => number): void {
  const x = cx * TILE;
  const bottom = (cy + 1) * TILE;
  for (let i = 0; i < 5; i++) {
    const sx = x + 1 + i * 3 + Math.floor(r() * 2);
    const h = 7 + Math.floor(r() * 5);
    ctx.fillStyle = '#5f9a3a';
    ctx.fillRect(sx, bottom - h, 1, h);
    // Heavy golden grain heads bend the stalk over.
    ctx.fillStyle = '#e2c25a';
    ctx.fillRect(sx + 1, bottom - h, 1, 1);
    ctx.fillRect(sx + 2, bottom - h + 1, 1, 2);
  }
}

function renderTerrain(lvl: Level): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(lvl.width, lvl.height);
  const r = seeded(lvl.cols * 31 + lvl.rows);
  // Deco first so solid tiles and grass tufts draw on top.
  for (let cy = 0; cy < lvl.rows; cy++) {
    for (let cx = 0; cx < lvl.cols; cx++) {
      const t = lvl.tile(cx, cy);
      if (t === 'f') drawFence(ctx, cx, cy);
      else if (t === 'y') drawPadi(ctx, cx, cy, r);
    }
  }
  for (let cy = 0; cy < lvl.rows; cy++) {
    for (let cx = 0; cx < lvl.cols; cx++) {
      const t = lvl.tile(cx, cy);
      if (t === '#') drawGround(ctx, lvl, cx, cy, r);
      else if (t === 'B') drawStone(ctx, lvl, cx, cy, r);
      else if (t === '=') drawBamboo(ctx, lvl, cx, cy);
      else if (t === '^') drawStakes(ctx, cx, cy, r);
    }
  }
  return c;
}
