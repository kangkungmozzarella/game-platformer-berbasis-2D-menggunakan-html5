import { MODERN } from './art';
import { TILE } from './constants';
import type { Level } from './level';
import { moveBody, type Body } from './physics';
import { drawAyam, drawLebah } from './modern/characters';
import { AYAM_SPR, LEBAH_SPR } from './sprites';

export interface Enemy extends Body {
  /** Set once stomped; the enemy plays a squash animation then disappears. */
  stomped: number;
  removed: boolean;
  update(dt: number, level: Level): void;
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void;
}

const SQUASH_TIME = 0.35;

/** Ayam jago: patrols a ledge, turning at walls and edges, and stops to peck now and then. */
export class Ayam implements Enemy {
  x: number;
  y: number;
  readonly w = 12;
  readonly h = 12;
  vx = -26;
  vy = 0;
  stomped = 0;
  removed = false;
  private dir: 1 | -1 = -1;
  private peck = 0;
  private time = Math.random() * 3;

  constructor(cx: number, cy: number) {
    this.x = cx * TILE + 2;
    this.y = (cy + 1) * TILE - this.h;
  }

  update(dt: number, level: Level): void {
    this.time += dt;
    if (this.stomped) {
      this.stomped += dt;
      if (this.stomped > SQUASH_TIME) this.removed = true;
      return;
    }
    if (this.peck > 0) {
      this.peck -= dt;
      this.vx = 0;
    } else {
      if (Math.random() < dt * 0.25) this.peck = 0.7;
      // Look one pixel ahead at foot level; turn around before walking off an edge.
      const aheadX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const aheadCol = Math.floor(aheadX / TILE);
      const footRow = Math.floor((this.y + this.h + 1) / TILE);
      const bodyRow = Math.floor((this.y + this.h - 1) / TILE);
      if (!level.isFloor(aheadCol, footRow) || level.tile(aheadCol, bodyRow) === '^') {
        this.dir = (this.dir * -1) as 1 | -1;
      }
      this.vx = this.dir * 26;
    }
    this.vy = Math.min(this.vy + 900 * dt, 380);
    const c = moveBody(this, level, dt);
    if (c.wallLeft || c.wallRight) this.dir = (this.dir * -1) as 1 | -1;
    if (this.y > level.height + 32) this.removed = true;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (MODERN) {
      drawAyam(ctx, this.x + this.w / 2 - camX, this.y + this.h - camY, this.dir, this.time, this.peck > 0, this.stomped > 0);
      return;
    }
    const img = this.peck > 0 ? AYAM_SPR.peck : AYAM_SPR.walk[Math.floor(this.time * 6) % 2];
    const cx = Math.round(this.x + this.w / 2 - camX);
    const bottom = Math.round(this.y + this.h - camY) + 1;
    ctx.save();
    ctx.translate(cx, bottom);
    if (this.stomped) ctx.scale(this.dir * 1.3, 0.35);
    else ctx.scale(this.dir, 1);
    ctx.drawImage(img, -8, -16);
    ctx.restore();
  }
}

/** Lebah: hovers in a lazy figure-eight around its nest, ignoring terrain. */
export class Lebah implements Enemy {
  x: number;
  y: number;
  readonly w = 10;
  readonly h = 7;
  vx = 0;
  vy = 0;
  stomped = 0;
  removed = false;
  private ox: number;
  private oy: number;
  private time = Math.random() * 6;

  constructor(cx: number, cy: number) {
    this.ox = cx * TILE + 3;
    this.oy = cy * TILE + 4;
    this.x = this.ox;
    this.y = this.oy;
  }

  update(dt: number): void {
    if (this.stomped) {
      this.stomped += dt;
      this.vy += 600 * dt;
      this.y += this.vy * dt;
      if (this.stomped > 1.2) this.removed = true;
      return;
    }
    this.time += dt;
    const nx = this.ox + Math.sin(this.time * 0.9) * 36;
    this.vx = (nx - this.x) / dt;
    this.x = nx;
    this.y = this.oy + Math.sin(this.time * 1.8) * 7;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (MODERN) {
      drawLebah(ctx, this.x + this.w / 2 - camX, this.y + this.h / 2 - camY, this.vx >= 0 ? 1 : -1, this.time, this.stomped > 0);
      return;
    }
    const img = LEBAH_SPR[Math.floor(this.time * 18) % 2];
    const cx = Math.round(this.x + this.w / 2 - camX);
    const cy = Math.round(this.y + this.h / 2 - camY);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(this.vx >= 0 ? 1 : -1, this.stomped ? -1 : 1);
    ctx.drawImage(img, -7, -4);
    ctx.restore();
  }
}
