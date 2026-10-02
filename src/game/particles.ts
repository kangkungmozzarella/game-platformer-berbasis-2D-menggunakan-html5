import { tinyText, tinyTextWidth } from '../engine/pixel';
import { MODERN } from './art';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

export interface BurstOptions {
  count: number;
  colors: string[];
  speed: number;
  life?: number;
  gravity?: number;
  size?: number;
  /** Restrict directions to the upper half (dust, splashes). */
  upward?: boolean;
}

export class Particles {
  private list: Particle[] = [];
  private popups: Popup[] = [];

  burst(x: number, y: number, o: BurstOptions): void {
    for (let i = 0; i < o.count; i++) {
      const angle = o.upward ? -Math.PI * (0.1 + Math.random() * 0.8) : Math.random() * Math.PI * 2;
      const speed = o.speed * (0.4 + Math.random() * 0.6);
      const life = (o.life ?? 0.5) * (0.6 + Math.random() * 0.4);
      this.list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        max: life,
        color: o.colors[Math.floor(Math.random() * o.colors.length)],
        size: o.size ?? 1,
        gravity: o.gravity ?? 0,
      });
    }
  }

  popup(text: string, x: number, y: number, color = '#fff6c8'): void {
    this.popups.push({ text, x, y, life: 0.9, color });
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.y -= 18 * dt;
      p.life -= dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (MODERN) {
      this.drawSmooth(ctx, camX, camY);
      return;
    }
    for (const p of this.list) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      if (p.life < 0.25 && Math.floor(p.life * 30) % 2) continue;
      tinyText(ctx, p.text, Math.round(p.x - camX - tinyTextWidth(p.text) / 2), Math.round(p.y - camY), p.color);
    }
  }

  private drawSmooth(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.list) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, (p.size * 0.8 + 0.4) * (0.5 + t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '600 8px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const p of this.popups) {
      // Pop in with a little overshoot, then fade.
      const age = 0.9 - p.life;
      const s = age < 0.15 ? 0.6 + (age / 0.15) * 0.55 : Math.max(1, 1.15 - (age - 0.15) * 1.5);
      ctx.globalAlpha = Math.min(1, p.life * 4);
      ctx.save();
      ctx.translate(p.x - camX, p.y - camY + 5);
      ctx.scale(s, s);
      ctx.strokeStyle = 'rgba(70,40,20,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.list = [];
    this.popups = [];
  }
}
