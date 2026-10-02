import type { SoundSystem } from '../engine/audio';
import type { Haptic } from '../engine/haptics';
import type { Input } from '../engine/input';
import { MODERN, snap } from './art';
import { drawBackground } from './background';
import { Buaya } from './buaya';
import { MAX_LIVES, SCORE, TILE, VIEW_H, VIEW_W } from './constants';
import { Ayam, Lebah, type Enemy } from './enemies';
import { Level } from './level';
import { drawAtmosphere, drawBackground as drawModernBackground } from './modern/background';
import { drawItem, drawGapura, drawUmbul } from './modern/items';
import { drawTerrain, drawWater as drawModernWater, renderTerrain, type Terrain } from './modern/terrain';
import type { LevelDef } from './levels';
import { Particles } from './particles';
import { overlaps, approach, type Box } from './physics';
import { Player } from './player';
import { KETUPAT, RAMBUTAN, TIMUN } from './sprites';

export interface Session {
  lives: number;
  score: number;
}

export interface LevelStats {
  timun: number;
  timunTotal: number;
  rambutan: number;
  stomps: number;
  /** Distinct crocodiles stepped on, counted aloud like in the folk tale. */
  buaya: number;
  levelScore: number;
}

export type WorldEvent = 'hud' | 'clear' | 'gameover';

type ItemKind = 'timun' | 'rambutan' | 'ketupat';

interface Item extends Box {
  kind: ItemKind;
  taken: boolean;
  phase: number;
}

interface Checkpoint extends Box {
  active: boolean;
  spawnX: number;
  spawnY: number;
}

const ITEM_SPRITES: Record<ItemKind, HTMLCanvasElement> = { timun: TIMUN, rambutan: RAMBUTAN, ketupat: KETUPAT };

export class World {
  readonly level: Level;
  readonly stats: LevelStats;
  private player = new Player();
  private enemies: Enemy[] = [];
  private buayas: Buaya[] = [];
  private riding: Buaya | null = null;
  private items: Item[] = [];
  private checkpoints: Checkpoint[] = [];
  private goal: Box & { cx: number };
  private particles = new Particles();
  private respawn = { x: 0, y: 0 };
  private camX = 0;
  private camY = 0;
  private lookX = 0;
  private time = 0;
  private shake = 0;
  private deathTimer = 0;
  private clearTimer = 0;
  private fade = 1;
  private terrain: Terrain | null;

  constructor(
    readonly def: LevelDef,
    private session: Session,
    private sound: SoundSystem,
    private haptic: Haptic,
    private emit: (e: WorldEvent) => void,
  ) {
    this.level = new Level(def);
    this.terrain = MODERN ? renderTerrain(this.level, def.theme) : null;
    this.goal = { x: 0, y: 0, w: 48, h: 48, cx: 0 };
    for (const s of this.level.spawns) {
      const px = s.cx * TILE;
      const py = s.cy * TILE;
      switch (s.kind) {
        case 'player':
          this.respawn = { x: px + 2, y: py + TILE - this.player.h };
          break;
        case 'timun':
        case 'rambutan':
        case 'ketupat':
          this.items.push({ kind: s.kind, x: px + 2, y: py + 2, w: 12, h: 12, taken: false, phase: s.cx * 0.7 });
          break;
        case 'ayam':
          this.enemies.push(new Ayam(s.cx, s.cy));
          break;
        case 'lebah':
          this.enemies.push(new Lebah(s.cx, s.cy));
          break;
        case 'buaya':
        case 'buaya-swim':
          this.buayas.push(new Buaya(s.cx, s.cy, s.kind === 'buaya-swim'));
          break;
        case 'checkpoint':
          this.checkpoints.push({ x: px + 2, y: py + TILE - 32, w: 12, h: 32, active: false, spawnX: px + 2, spawnY: py + TILE - this.player.h });
          break;
        case 'goal':
          this.goal = { x: px + 8 - 24, y: py + TILE - 48, w: 48, h: 48, cx: px + 8 };
          break;
      }
    }
    this.stats = {
      timun: 0,
      timunTotal: this.items.filter((i) => i.kind === 'timun').length,
      rambutan: 0,
      stomps: 0,
      buaya: 0,
      levelScore: 0,
    };
    this.player.spawn(this.respawn.x, this.respawn.y);
    this.snapCamera();
  }

  get finished(): boolean {
    return this.clearTimer !== 0;
  }

  update(dt: number, input: Input): void {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const p = this.player;

    for (const b of this.buayas) {
      b.update(dt, this.riding === b);
      if (b.diving) {
        this.particles.burst(b.x + b.w / 2, b.y + 4, { count: 12, colors: ['#a8dcff', '#ffffff'], speed: 40, life: 0.8, gravity: -60, upward: true });
      }
    }
    // A swimming buaya carries whoever stands on it.
    if (this.riding && !p.dead) p.x += this.riding.dx;

    const ev = p.update(dt, input, this.level);
    if (ev.jumped) {
      this.sound.play('jump');
      this.haptic.buzz('light');
      this.dust(p.x + p.w / 2, p.y + p.h, 4);
    }
    this.rideBuaya();
    if (ev.landed > 250) this.dust(p.x + p.w / 2, p.y + p.h, 6);

    for (const e of this.enemies) e.update(dt, this.level);
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.particles.update(dt);

    if (p.dead) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0.35) this.fade = approach(this.fade, 1, dt * 4);
      if (this.deathTimer <= 0) this.afterDeath();
    } else if (this.clearTimer < 0) {
      // Level already reported as cleared; wait for the UI to move on.
    } else if (this.clearTimer > 0) {
      this.clearTimer += dt;
      if (this.clearTimer > 1.1) this.fade = approach(this.fade, 1, dt * 2.5);
      if (this.clearTimer > 1.6 && this.fade >= 1) {
        this.clearTimer = -1;
        this.emit('clear');
      }
    } else {
      this.fade = approach(this.fade, 0, dt * 3);
      this.checkHazards();
      if (!p.dead) this.checkEnemies(input);
      this.checkItems();
      this.checkCheckpoints();
      this.checkGoal();
    }
    this.updateCamera(dt);
  }

  private rideBuaya(): void {
    const p = this.player;
    const prev = this.riding;
    this.riding = null;
    if (p.dead || p.vy < 0) return;
    for (const b of this.buayas) {
      if (!b.solid || p.x + p.w <= b.x || p.x >= b.x + b.w) continue;
      // Same one-way rule as bamboo rafts: only from above. The slack covers a sinking back.
      if (p.prevBottom <= b.y + 4 && p.y + p.h >= b.y) {
        p.land(b.y, prev !== b);
        this.riding = b;
        if (!b.counted) {
          b.counted = true;
          this.stats.buaya++;
          this.session.score += 20;
          this.stats.levelScore += 20;
          this.particles.popup(String(this.stats.buaya), b.x + b.w / 2, b.y - 18, '#f2d14a');
          this.sound.play('count');
          this.haptic.buzz('light');
          this.emit('hud');
        }
        return;
      }
    }
  }

  private checkHazards(): void {
    const p = this.player;
    if (p.y > this.level.height + 16) {
      this.die(false);
      return;
    }
    const c0 = Math.floor(p.x / TILE);
    const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
    const r0 = Math.floor(p.y / TILE);
    const r1 = Math.floor((p.y + p.h - 0.001) / TILE);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const t = this.level.tile(cx, cy);
        if (t === '^' && overlaps(p, { x: cx * TILE + 1, y: cy * TILE + 6, w: 14, h: 10 })) {
          this.die(true);
          return;
        }
      }
    }
    // Sink a few pixels into the river before it counts.
    const footRow = Math.floor((p.y + p.h - 4) / TILE);
    if (this.level.tile(Math.floor((p.x + p.w / 2) / TILE), footRow) === '~') {
      this.particles.burst(p.x + p.w / 2, footRow * TILE + 3, {
        count: 18, colors: ['#9fd8ff', '#ffffff', '#5aa0e0'], speed: 110, life: 0.7, gravity: 500, upward: true,
      });
      this.sound.play('splash');
      this.die(false);
    }
  }

  private checkEnemies(input: Input): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.stomped || !overlaps(p, e)) continue;
      // A stomp needs the kancil falling and its feet near the enemy's head on the previous step.
      if (p.vy > 0 && p.prevBottom <= e.y + 5) {
        e.stomped = 0.0001;
        e.vy = -60;
        p.bounce(input.down('jump'));
        this.stats.stomps++;
        this.addScore(SCORE.stomp, e.x + e.w / 2, e.y - 4);
        this.sound.play('stomp');
        this.haptic.buzz('medium');
        this.particles.burst(e.x + e.w / 2, e.y + e.h / 2, {
          count: 10,
          colors: e instanceof Ayam ? ['#f2e2c0', '#c8642a', '#2f6d4a'] : ['#f5c431', '#1e1a14', '#eaf6ff'],
          speed: 70, life: 0.6, gravity: 120,
        });
      } else if (p.invulnerable <= 0) {
        this.die(true);
        return;
      }
    }
  }

  private checkItems(): void {
    const p = this.player;
    for (const it of this.items) {
      if (it.taken || !overlaps(p, it)) continue;
      it.taken = true;
      const cx = it.x + it.w / 2;
      const cy = it.y + it.h / 2;
      if (it.kind === 'timun') {
        this.stats.timun++;
        this.addScore(SCORE.timun, cx, cy - 8);
        this.sound.play('timun');
        if (this.stats.timun === this.stats.timunTotal) {
          this.addScore(SCORE.allTimunBonus, cx, cy - 16);
          this.sound.play('rambutan');
        }
      } else if (it.kind === 'rambutan') {
        this.stats.rambutan++;
        this.addScore(SCORE.rambutan, cx, cy - 8);
        this.sound.play('rambutan');
      } else {
        this.session.lives = Math.min(MAX_LIVES, this.session.lives + 1);
        this.particles.popup('+1', cx, cy - 8, '#ffb3a8');
        this.sound.play('ketupat');
        this.haptic.buzz('light');
        this.emit('hud');
      }
      this.particles.burst(cx, cy, { count: 10, colors: ['#fff6c8', '#ffffff', '#f2c94c'], speed: 60, life: 0.45 });
    }
  }

  private checkCheckpoints(): void {
    for (const cp of this.checkpoints) {
      if (cp.active || !overlaps(this.player, cp)) continue;
      cp.active = true;
      this.respawn = { x: cp.spawnX, y: cp.spawnY };
      this.sound.play('checkpoint');
      this.haptic.buzz('light');
      this.particles.burst(cp.x + 6, cp.y + 4, { count: 16, colors: ['#e2453c', '#ffffff', '#f2c94c'], speed: 80, life: 0.8, gravity: 80 });
    }
  }

  private checkGoal(): void {
    const p = this.player;
    if (!p.onGround) return;
    if (p.x + p.w / 2 >= this.goal.cx - 6 && overlaps(p, this.goal)) {
      p.autoRun = true;
      this.clearTimer = 0.0001;
      this.sound.play('win');
      this.particles.burst(this.goal.cx, this.goal.y + 10, { count: 30, colors: ['#f2c94c', '#ffffff', '#e2453c', '#7cb342'], speed: 120, life: 1.2, gravity: 140 });
    }
  }

  private die(withHop: boolean): void {
    const p = this.player;
    if (p.dead) return;
    p.kill();
    this.riding = null;
    if (!withHop) p.vy = 0;
    this.haptic.buzz('heavy');
    this.deathTimer = 1.4;
    this.shake = 0.3;
    this.session.lives--;
    this.sound.play('hurt');
    this.emit('hud');
  }

  private afterDeath(): void {
    if (this.session.lives <= 0) {
      this.deathTimer = Infinity;
      this.sound.play('gameover');
      this.emit('gameover');
      return;
    }
    this.player.spawn(this.respawn.x, this.respawn.y);
    this.player.invulnerable = 1.5;
    this.snapCamera();
  }

  private addScore(points: number, x: number, y: number): void {
    this.session.score += points;
    this.stats.levelScore += points;
    this.particles.popup(`+${points}`, x, y);
    this.emit('hud');
  }

  private dust(x: number, y: number, count: number): void {
    this.particles.burst(x, y - 1, { count, colors: ['#d9c3a0', '#bfa47e'], speed: 40, life: 0.35, upward: true });
  }

  // ------------------------------------------------------------ camera

  private cameraTarget(): [number, number] {
    const p = this.player;
    return [p.x + p.w / 2 + this.lookX - VIEW_W / 2, p.y + p.h / 2 - VIEW_H * 0.55];
  }

  private clampCamera(): void {
    this.camX = Math.max(0, Math.min(this.camX, this.level.width - VIEW_W));
    this.camY = Math.max(0, Math.min(this.camY, this.level.height - VIEW_H));
  }

  private snapCamera(): void {
    this.lookX = this.player.facing * 28;
    [this.camX, this.camY] = this.cameraTarget();
    this.clampCamera();
  }

  private updateCamera(dt: number): void {
    if (this.player.dead) return;
    // Look ahead in the walking direction so the kancil sees what's coming.
    this.lookX = approach(this.lookX, this.player.facing * 28, dt * 50);
    const [tx, ty] = this.cameraTarget();
    this.camX += (tx - this.camX) * Math.min(1, dt * 5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 4);
    this.clampCamera();
  }

  // ------------------------------------------------------------ drawing

  draw(ctx: CanvasRenderingContext2D): void {
    const sh = this.shake > 0 ? 2 : 0;
    const camX = snap(this.camX + (Math.random() - 0.5) * sh * 2);
    const camY = snap(this.camY + (Math.random() - 0.5) * sh * 2);

    if (this.terrain) {
      drawModernBackground(ctx, this.def.theme, camX, camY, this.time);
      drawTerrain(ctx, this.terrain, camX, camY, VIEW_W);
      drawGapura(ctx, this.goal.cx - camX, this.goal.y + this.goal.h - camY, this.time);
      for (const cp of this.checkpoints) drawUmbul(ctx, cp.x + 4 - camX, cp.y + cp.h - camY, cp.active, this.time);
      for (const it of this.items) {
        if (!it.taken) drawItem(ctx, it.kind, it.x + it.w / 2 - camX, it.y + it.h / 2 - camY, this.time, it.phase);
      }
    } else {
      drawBackground(ctx, this.def.theme, camX, camY, this.time);
      ctx.drawImage(this.level.image!, -camX, -camY);
      this.drawGoal(ctx, camX, camY);
      for (const cp of this.checkpoints) this.drawCheckpoint(ctx, cp, camX, camY);
      for (const it of this.items) {
        if (it.taken) continue;
        const img = ITEM_SPRITES[it.kind];
        const bob = Math.round(Math.sin(this.time * 3 + it.phase) * 1.5);
        ctx.drawImage(img, Math.round(it.x + it.w / 2 - 8 - camX), Math.round(it.y + it.h / 2 - img.height / 2 - camY + bob));
      }
    }
    for (const b of this.buayas) b.draw(ctx, camX, camY);
    for (const e of this.enemies) e.draw(ctx, camX, camY);
    this.player.draw(ctx, camX, camY);
    if (this.terrain) drawModernWater(ctx, this.terrain, camX, camY, VIEW_W, VIEW_H, this.time);
    else this.drawWater(ctx, camX, camY);
    this.particles.draw(ctx, camX, camY);
    if (MODERN) drawAtmosphere(ctx, this.def.theme, camX, camY, this.time);

    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = '#1b1210';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawWater(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const c0 = Math.floor(camX / TILE);
    const c1 = Math.ceil((camX + VIEW_W) / TILE);
    const r0 = Math.floor(camY / TILE);
    const r1 = Math.ceil((camY + VIEW_H) / TILE);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (this.level.tile(cx, cy) !== '~') continue;
        const px = cx * TILE - camX;
        const py = cy * TILE - camY;
        const surface = this.level.tile(cx, cy - 1) !== '~';
        ctx.globalAlpha = 0.82;
        if (!surface) {
          ctx.fillStyle = '#2c5f9e';
          ctx.fillRect(px, py, TILE, TILE);
          continue;
        }
        for (let x = 0; x < TILE; x++) {
          const wx = cx * TILE + x;
          const top = 3 + Math.round(Math.sin(this.time * 3 + wx * 0.35) * 1.3);
          ctx.fillStyle = '#3d7bc8';
          ctx.fillRect(px + x, py + top, 1, TILE - top);
          ctx.fillStyle = '#a8dcff';
          ctx.fillRect(px + x, py + top, 1, 1);
        }
        // Drifting glints on the surface.
        const glint = Math.floor((this.time * 8 + cx * 5) % 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + glint, py + 7, 2, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, cp: Checkpoint, camX: number, camY: number): void {
    const x = Math.round(cp.x + 4 - camX);
    const bottom = Math.round(cp.y + cp.h - camY);
    // Umbul-umbul: a tall bamboo pole whose tip bends over, with a long pennant.
    ctx.fillStyle = '#8f7d35';
    ctx.fillRect(x, bottom - 30, 2, 30);
    ctx.fillStyle = '#c9b458';
    ctx.fillRect(x, bottom - 30, 1, 30);
    ctx.fillStyle = '#8f7d35';
    ctx.fillRect(x + 1, bottom - 32, 2, 2);
    ctx.fillRect(x + 3, bottom - 33, 3, 1);
    ctx.fillRect(x + 6, bottom - 32, 1, 2);
    if (!cp.active) {
      ctx.fillStyle = '#7a6a5a';
      ctx.fillRect(x + 2, bottom - 29, 3, 8);
      return;
    }
    for (let i = 0; i < 20; i++) {
      const wave = Math.round(Math.sin(this.time * 5 - i * 0.4) * 1.5 * (i / 20));
      const w = Math.max(1, 5 - Math.floor(i / 5));
      ctx.fillStyle = i < 10 ? '#e2453c' : '#f4f1e6';
      ctx.fillRect(x + 2 + wave, bottom - 29 + i, w, 1);
    }
  }

  private drawGoal(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const g = this.goal;
    const x = Math.round(g.x - camX);
    const bottom = Math.round(g.y + g.h - camY);
    // Candi bentar: a split brick gate with stepped tops.
    const pillar = (px: number, mirror: boolean) => {
      const tiers = [[16, 30], [14, 8], [11, 5], [8, 4], [4, 3]];
      let y = bottom;
      for (const [w, h] of tiers) {
        const ox = mirror ? px + 16 - w : px;
        y -= h;
        ctx.fillStyle = '#b5543a';
        ctx.fillRect(ox, y, w, h);
        ctx.fillStyle = '#d27a5a';
        ctx.fillRect(ox, y, w, 1);
        ctx.fillStyle = '#7a3424';
        ctx.fillRect(mirror ? ox : ox + w - 1, y, 1, h);
        for (let by = y + 3; by < y + h; by += 3) ctx.fillRect(ox + (by % 2 ? 2 : 5), by, 1, 1);
      }
      ctx.fillStyle = '#7a3424';
      ctx.fillRect(px, bottom - 30, 16, 1);
    };
    pillar(x, false);
    pillar(x + 32, true);
    // Janur kuning arching over the opening.
    for (let i = 0; i <= 20; i++) {
      const ax = x + 14 + i;
      const ay = bottom - 44 - Math.round(Math.sin((i / 20) * Math.PI) * 8);
      ctx.fillStyle = '#e8d77a';
      ctx.fillRect(ax, ay, 1, 2);
      if (i % 4 === 0) {
        const sway = Math.round(Math.sin(this.time * 4 + i) * 1);
        ctx.fillStyle = '#f2e6a0';
        ctx.fillRect(ax + sway, ay + 2, 1, 4);
      }
    }
  }
}
