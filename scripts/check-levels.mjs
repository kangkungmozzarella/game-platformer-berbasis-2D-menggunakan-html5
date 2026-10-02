// Proves every level can be finished and every item collected, using the real game physics.
// It explores all standing spots reachable by walking and full-height jumps (enemies removed,
// hazards still deadly), once with the normal kancil and once with a deliberately weakened one,
// so no jump in the game needs pixel-perfect timing.
//
// Usage: npm run check:levels   (needs Google Chrome installed)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const STRENGTHS = [1, 0.9];

const server = await createServer({ logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', String(e)));
await page.goto(url);

let failed = false;
for (const strength of STRENGTHS) {
  const results = await page.evaluate(async (strength) => {
    const { World } = await import('/src/game/world.ts');
    const { LEVELS } = await import('/src/game/levels.ts');
    const { Buaya } = await import('/src/game/buaya.ts');
    const { MOVE } = await import('/src/game/player.ts');
    const base = { ...MOVE };
    MOVE.jumpVelocity = base.jumpVelocity * strength;
    MOVE.runSpeed = base.runSpeed * strength;
    const DT = 1 / 60;
    const out = [];
    for (const def of LEVELS) {
      const w = new World(def, { lives: 999, score: 0 }, { play() {}, music() {} }, { buzz() {} }, () => {});
      w.enemies = [];
      const p = w.player;
      const crocs = w.level.spawns.filter((s) => s.kind === 'buaya' || s.kind === 'buaya-swim');
      const idle = { down: () => false, pressed: () => false };

      const reset = (x, y, vx) => {
        w.buayas = crocs.map((s) => new Buaya(s.cx, s.cy, s.kind === 'buaya-swim'));
        w.riding = null;
        w.clearTimer = 0;
        w.deathTimer = 0;
        p.spawn(x, y);
        p.onGround = true;
        p.invulnerable = 0;
        for (let i = 0; i < 2; i++) w.update(DT, idle);
        p.vx = vx;
        p.facing = vx < 0 ? -1 : 1;
      };

      // Walk or jump from (x, y); returns where the kancil comes to stand, 'goal', or null if it died.
      const sim = (x, y, vx, dir, jumpFrames, walkFrames) => {
        reset(x, y, vx);
        if (p.dead || !p.onGround) return null;
        let f = 0;
        const inp = {
          down: (a) => (a === 'left' ? dir < 0 : a === 'right' ? dir > 0 : a === 'jump' && f < jumpFrames),
          pressed: (a) => a === 'jump' && f === 0 && jumpFrames > 0,
        };
        let airborne = false;
        for (; f < 150; f++) {
          w.update(DT, inp);
          if (p.dead) return null;
          if (w.clearTimer !== 0) return 'goal';
          if (!p.onGround) airborne = true;
          else if (airborne || (jumpFrames === 0 && f >= walkFrames)) return [p.x, p.y];
        }
        return null;
      };

      const actions = [];
      for (const dir of [-1, 1]) for (const wf of [4, 12, 40]) actions.push([0, dir, 0, wf]);
      for (const dir of [-1, 0, 1]) for (const vx of dir ? [0, dir * MOVE.runSpeed] : [0]) actions.push([vx, dir, 40, 0]);

      const key = (x, y) => `${Math.round(x / 3)},${Math.round(y)}`;
      const start = [w.respawn.x, w.respawn.y];
      const seen = new Set([key(...start)]);
      const queue = [start];
      let goal = false;
      let furthest = 0;
      while (queue.length && seen.size < 20000) {
        const [x, y] = queue.shift();
        furthest = Math.max(furthest, x);
        for (const [vx, dir, jf, wf] of actions) {
          const r = sim(x, y, vx, dir, jf, wf);
          if (r === 'goal') goal = true;
          else if (r && !seen.has(key(r[0], r[1]))) {
            seen.add(key(r[0], r[1]));
            queue.push(r);
          }
        }
      }
      const missed = w.items.filter((i) => !i.taken).map((i) => `${i.kind} (kolom ${Math.floor(i.x / 16)}, baris ${Math.floor(i.y / 16)})`);
      out.push({ name: def.name, goal, furthestCol: Math.floor(furthest / 16), missed });
    }
    Object.assign(MOVE, base);
    return out;
  }, strength);

  console.log(`\nKekuatan kancil ${Math.round(strength * 100)}%`);
  for (const r of results) {
    const ok = r.goal && r.missed.length === 0;
    if (!ok) failed = true;
    const why = !r.goal ? `finis tidak terjangkau (mentok di kolom ${r.furthestCol})` : `${r.missed.length} item tidak terjangkau: ${r.missed.join(', ')}`;
    console.log(`  ${ok ? '✓' : '✗'} ${r.name}${ok ? '' : ` — ${why}`}`);
  }
}

await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
