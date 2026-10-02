import { TILE } from './constants';
import type { Level } from './level';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Body extends Box {
  vx: number;
  vy: number;
}

export interface Contacts {
  ground: boolean;
  ceiling: boolean;
  wallLeft: boolean;
  wallRight: boolean;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/** Moves a body one axis at a time, resolving against solid tiles and one-way bamboo platforms. */
export function moveBody(b: Body, level: Level, dt: number): Contacts {
  const c: Contacts = { ground: false, ceiling: false, wallLeft: false, wallRight: false };
  const rowsSpanned = () => [Math.floor(b.y / TILE), Math.floor((b.y + b.h - 0.001) / TILE)];
  const colsSpanned = () => [Math.floor(b.x / TILE), Math.floor((b.x + b.w - 0.001) / TILE)];

  b.x += b.vx * dt;
  if (b.vx > 0) {
    const cx = Math.floor((b.x + b.w - 0.001) / TILE);
    const [r0, r1] = rowsSpanned();
    for (let cy = r0; cy <= r1; cy++) {
      if (level.isSolid(cx, cy)) {
        b.x = cx * TILE - b.w;
        b.vx = 0;
        c.wallRight = true;
        break;
      }
    }
  } else if (b.vx < 0) {
    const cx = Math.floor(b.x / TILE);
    const [r0, r1] = rowsSpanned();
    for (let cy = r0; cy <= r1; cy++) {
      if (level.isSolid(cx, cy)) {
        b.x = (cx + 1) * TILE;
        b.vx = 0;
        c.wallLeft = true;
        break;
      }
    }
  }

  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  if (b.vy > 0) {
    const cy = Math.floor((b.y + b.h - 0.001) / TILE);
    const [c0, c1] = colsSpanned();
    for (let cx = c0; cx <= c1; cx++) {
      const oneWay = level.isPlatform(cx, cy) && prevBottom <= cy * TILE + 0.01;
      if (level.isSolid(cx, cy) || oneWay) {
        b.y = cy * TILE - b.h;
        b.vy = 0;
        c.ground = true;
        break;
      }
    }
  } else if (b.vy < 0) {
    const cy = Math.floor(b.y / TILE);
    const [c0, c1] = colsSpanned();
    for (let cx = c0; cx <= c1; cx++) {
      if (level.isSolid(cx, cy)) {
        b.y = (cy + 1) * TILE;
        b.vy = 0;
        c.ceiling = true;
        break;
      }
    }
  }
  return c;
}
