import type { Input } from '../engine/input';
import { MODERN } from './art';
import type { Level } from './level';
import { approach, moveBody, type Body } from './physics';
import { drawKancil } from './modern/characters';
import { HERO } from './sprites';

/**
 * Movement tuning in px and seconds; one tile is 16 px. Kept in one mutable object so the
 * level reachability check can try a weakened kancil and prove the levels have slack.
 */
export const MOVE = {
  runSpeed: 100,
  groundAccel: 900,
  groundDecel: 1100,
  airAccel: 640,
  gravity: 900,
  fallGravityMult: 1.55,
  jumpVelocity: 320,
  jumpCut: 0.45,
  maxFall: 380,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  stompBounce: 210,
  stompBounceHeld: 300,
};

export interface PlayerEvents {
  jumped: boolean;
  /** Downward speed at the moment of landing, 0 if the player didn't land this step. */
  landed: number;
}

export class Player implements Body {
  x = 0;
  y = 0;
  readonly w = 12;
  readonly h = 12;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  onGround = false;
  dead = false;
  /** When set, input is ignored and the kancil trots right (used at the finish gate). */
  autoRun = false;
  invulnerable = 0;
  prevBottom = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private jumpCuttable = false;
  private animTime = 0;
  private squash = 0;

  spawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.autoRun = false;
    this.onGround = false;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  update(dt: number, input: Input, level: Level): PlayerEvents {
    const ev: PlayerEvents = { jumped: false, landed: 0 };
    this.prevBottom = this.y + this.h;
    this.animTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.squash = approach(this.squash, 0, dt * 4);

    if (this.dead) {
      this.vy = Math.min(this.vy + MOVE.gravity * dt, MOVE.maxFall);
      this.y += this.vy * dt;
      return ev;
    }

    const dir = this.autoRun ? 1 : (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;
    const accel = this.onGround ? (dir !== 0 ? MOVE.groundAccel : MOVE.groundDecel) : MOVE.airAccel;
    this.vx = approach(this.vx, dir * (this.autoRun ? MOVE.runSpeed * 0.6 : MOVE.runSpeed), accel * dt);

    // Coyote time lets a jump still register just after running off a ledge;
    // the jump buffer remembers a press made just before landing.
    this.coyote = this.onGround ? MOVE.coyoteTime : this.coyote - dt;
    const jumpPressed = !this.autoRun && input.pressed('jump');
    this.jumpBuffer = jumpPressed ? MOVE.jumpBuffer : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -MOVE.jumpVelocity;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.jumpCuttable = true;
      this.squash = -0.25;
      ev.jumped = true;
    }
    // Releasing jump early gives a shorter hop.
    if (this.jumpCuttable && !input.down('jump') && this.vy < 0) {
      this.vy *= MOVE.jumpCut;
      this.jumpCuttable = false;
    }

    const g = this.vy > 0 ? MOVE.gravity * MOVE.fallGravityMult : MOVE.gravity;
    this.vy = Math.min(this.vy + g * dt, MOVE.maxFall);
    const fallSpeed = this.vy;
    const wasGround = this.onGround;
    const contacts = moveBody(this, level, dt);
    this.onGround = contacts.ground;
    if (this.onGround) this.jumpCuttable = false;
    if (this.onGround && !wasGround) {
      ev.landed = fallSpeed;
      this.squash = Math.min(0.3, fallSpeed / 1000);
    }
    return ev;
  }

  /** Stands the kancil on a moving platform (a buaya's back) whose top is at `top`. */
  land(top: number, firstContact: boolean): void {
    this.y = top - this.h;
    this.vy = 0;
    this.onGround = true;
    this.jumpCuttable = false;
    if (firstContact) this.squash = 0.2;
  }

  /** Called after landing on an enemy; holding jump bounces higher. */
  bounce(jumpHeld: boolean): void {
    this.vy = -(jumpHeld ? MOVE.stompBounceHeld : MOVE.stompBounce);
    this.jumpCuttable = jumpHeld;
    this.onGround = false;
    this.squash = -0.2;
  }

  kill(): void {
    this.dead = true;
    this.vy = -260;
    this.vx = 0;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.dead && this.invulnerable > 0 && Math.floor(this.invulnerable * 16) % 2) return;
    if (MODERN) {
      const pose = this.dead ? 'dead' : !this.onGround ? (this.vy < 0 ? 'jump' : 'fall') : Math.abs(this.vx) > 8 ? 'run' : 'idle';
      drawKancil(ctx, this.x + this.w / 2 - camX, this.y + this.h - camY, this.facing, pose, this.animTime, this.squash, this.onGround);
      return;
    }
    let img: HTMLCanvasElement;
    if (this.dead) img = HERO.hurt;
    else if (!this.onGround) img = this.vy < 0 ? HERO.jump : HERO.fall;
    else if (Math.abs(this.vx) > 8) img = HERO.run[Math.floor(this.animTime * 12) % HERO.run.length];
    // Ears twitch now and then while standing still.
    else img = HERO.idle[this.animTime % 2.4 < 0.15 ? 1 : 0];

    const sx = 1 + this.squash;
    const sy = 1 - this.squash;
    const cx = Math.round(this.x + this.w / 2 - camX);
    const bottom = Math.round(this.y + this.h - camY);
    ctx.save();
    ctx.translate(cx, this.dead ? bottom - 8 : bottom + 1);
    ctx.scale(this.facing * sx, this.dead ? -1 : sy);
    ctx.drawImage(img, -8, this.dead ? -8 : -16);
    ctx.restore();
  }
}
