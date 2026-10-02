import type { Input } from '../engine/input';
import type { Level } from './level';
import { approach, moveBody, type Body } from './physics';
import { HERO } from './sprites';

// Tuned in px and seconds; one tile is 16 px.
const RUN_SPEED = 96;
const GROUND_ACCEL = 900;
const GROUND_DECEL = 1100;
const AIR_ACCEL = 640;
const GRAVITY = 900;
const FALL_GRAVITY_MULT = 1.55;
const JUMP_VELOCITY = 300;
const JUMP_CUT = 0.45;
const MAX_FALL = 380;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;
const STOMP_BOUNCE = 210;
const STOMP_BOUNCE_HELD = 300;

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
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
      this.y += this.vy * dt;
      return ev;
    }

    const dir = this.autoRun ? 1 : (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0);
    if (dir !== 0) this.facing = dir as 1 | -1;
    const accel = this.onGround ? (dir !== 0 ? GROUND_ACCEL : GROUND_DECEL) : AIR_ACCEL;
    this.vx = approach(this.vx, dir * (this.autoRun ? RUN_SPEED * 0.6 : RUN_SPEED), accel * dt);

    // Coyote time lets a jump still register just after running off a ledge;
    // the jump buffer remembers a press made just before landing.
    this.coyote = this.onGround ? COYOTE_TIME : this.coyote - dt;
    const jumpPressed = !this.autoRun && input.pressed('jump');
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.jumpCuttable = true;
      this.squash = -0.25;
      ev.jumped = true;
    }
    // Releasing jump early gives a shorter hop.
    if (this.jumpCuttable && !input.down('jump') && this.vy < 0) {
      this.vy *= JUMP_CUT;
      this.jumpCuttable = false;
    }

    const g = this.vy > 0 ? GRAVITY * FALL_GRAVITY_MULT : GRAVITY;
    this.vy = Math.min(this.vy + g * dt, MAX_FALL);
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

  /** Called after landing on an enemy; holding jump bounces higher. */
  bounce(jumpHeld: boolean): void {
    this.vy = -(jumpHeld ? STOMP_BOUNCE_HELD : STOMP_BOUNCE);
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
