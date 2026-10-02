import { TILE } from './constants';
import type { Box } from './physics';
import { BUAYA_SPR } from './sprites';

type State = 'float' | 'warn' | 'sink' | 'under' | 'rise';

const STAND_LIMIT = 0.6;
const WARN_TIME = 0.45;
const SINK_SPEED = 30;
const RISE_SPEED = 20;
const SINK_DEPTH = 24;
const UNDER_TIME = 1.5;
const SWIM_RANGE = 20;

/**
 * Buaya: a floating platform from the Kancil folk tale. Stand on its back too long
 * and it shudders, then dives, taking the kancil with it.
 */
export class Buaya implements Box {
  x: number;
  y: number;
  readonly w = 30;
  readonly h = 6;
  /** Horizontal movement this step, used to carry a rider along. */
  dx = 0;
  counted = false;
  private readonly baseY: number;
  private readonly originX: number;
  private state: State = 'float';
  private timer = 0;
  private standTime = 0;
  private time = Math.random() * 6;
  private facing: 1 | -1;

  constructor(cx: number, cy: number, readonly swims: boolean) {
    this.originX = cx * TILE + 1;
    this.x = this.originX;
    // Its back pokes 5 px above the river surface one row below the spawn tile.
    this.baseY = (cy + 1) * TILE - 5;
    this.y = this.baseY;
    this.facing = cx % 2 === 0 ? 1 : -1;
  }

  /** Whether its back can currently be stood on. */
  get solid(): boolean {
    return this.state !== 'under';
  }

  update(dt: number, ridden: boolean): void {
    this.time += dt;
    const prevX = this.x;
    if (this.swims && this.state !== 'under') {
      this.x = this.originX + Math.sin(this.time * 0.8) * SWIM_RANGE;
      const dir = Math.cos(this.time * 0.8);
      if (Math.abs(dir) > 0.05) this.facing = dir > 0 ? 1 : -1;
    }
    this.dx = this.x - prevX;

    switch (this.state) {
      case 'float':
        if (ridden) this.standTime += dt;
        if (this.standTime > STAND_LIMIT) this.enter('warn', WARN_TIME);
        break;
      case 'warn':
        this.timer -= dt;
        if (this.timer <= 0) this.enter('sink', 0);
        break;
      case 'sink':
        this.y += SINK_SPEED * dt;
        if (this.y >= this.baseY + SINK_DEPTH) this.enter('under', UNDER_TIME);
        break;
      case 'under':
        this.timer -= dt;
        if (this.timer <= 0) this.enter('rise', 0);
        break;
      case 'rise':
        this.y -= RISE_SPEED * dt;
        if (this.y <= this.baseY) {
          this.y = this.baseY;
          this.standTime = 0;
          this.enter('float', 0);
        }
        break;
    }
  }

  /** True on the step the buaya starts diving, so the world can spawn bubbles. */
  get diving(): boolean {
    return this.state === 'sink' && this.y - this.baseY < SINK_SPEED / 60;
  }

  private enter(state: State, timer: number): void {
    this.state = state;
    this.timer = timer;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (this.state === 'under') return;
    const shake = this.state === 'warn' ? Math.round(Math.sin(this.time * 60)) : 0;
    const bob = this.state === 'float' ? Math.round(Math.sin(this.time * 2) * 0.6) : 0;
    const blink = this.time % 3.5 < 0.12 ? 1 : 0;
    const x = Math.round(this.x - 1 - camX) + shake;
    const y = Math.round(this.y - 3 - camY) + bob;
    ctx.save();
    ctx.translate(x + 16, y);
    ctx.scale(this.facing, 1);
    ctx.drawImage(BUAYA_SPR[blink], -16, 0);
    ctx.restore();
  }
}
