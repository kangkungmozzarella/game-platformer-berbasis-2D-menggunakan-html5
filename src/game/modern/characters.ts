import { circle, ellipse, groundShadow, paint, roundRect, vgrad, type Ctx } from './draw';

// Characters are drawn around their feet (x = centre, y = ground), facing right; callers flip.

export type KancilPose = 'idle' | 'run' | 'jump' | 'fall' | 'dead';

const K = {
  line: '#6b3f22',
  fur: '#cf9258',
  furTop: '#e2ac74',
  furDark: '#a86a3c',
  legFar: '#8e5733',
  belly: '#f7e6cc',
  hoof: '#4a2e1c',
  eye: '#2a1a12',
  ear: '#f2b2a6',
  nose: '#3a2418',
  blush: 'rgba(240,120,110,0.45)',
};

function leg(ctx: Ctx, hx: number, hy: number, angle: number, len: number, color: string): void {
  const fx = hx + Math.sin(angle) * len;
  const fy = hy + Math.cos(angle) * len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = K.line;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.05;
  ctx.stroke();
  ctx.fillStyle = K.hoof;
  ellipse(ctx, fx + 0.3, fy - 0.2, 0.9, 0.65);
  ctx.fill();
}

export function drawKancil(
  ctx: Ctx,
  x: number,
  y: number,
  facing: number,
  pose: KancilPose,
  time: number,
  squash: number,
  grounded: boolean,
): void {
  if (grounded && pose !== 'dead') groundShadow(ctx, x, y + 0.3, 15);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * (1 + squash), 1 - squash);
  if (pose === 'dead') {
    // Tumbles upside down.
    ctx.translate(0, -8);
    ctx.scale(1, -1);
    ctx.translate(0, 8);
  }

  const phase = time * 14;
  const run = pose === 'run';
  const bob = run ? -Math.abs(Math.sin(phase)) * 1.3 : pose === 'idle' ? Math.sin(time * 2.4) * 0.3 : 0;
  const hipY = -6.2 + bob;
  const legAngle = (front: boolean, offset: number): number => {
    if (run) return Math.sin(phase + offset) * 0.75;
    if (pose === 'jump') return front ? -1.1 : 1.0;
    if (pose === 'fall' || pose === 'dead') return front ? 0.45 : -0.45;
    return 0;
  };
  const legLen = pose === 'jump' ? 4.2 : 6;

  // Far legs sit behind the body.
  leg(ctx, -3.6, hipY, legAngle(false, Math.PI), legLen, K.legFar);
  leg(ctx, 3.4, hipY, legAngle(true, 0), legLen, K.legFar);

  // Little white-tipped tail.
  ctx.save();
  ctx.translate(-6.6, -9.4 + bob);
  ctx.rotate(-0.5 + Math.sin(time * 9) * 0.25);
  ellipse(ctx, -0.8, 0, 1.9, 1.2);
  paint(ctx, K.fur, K.line);
  ellipse(ctx, -1.8, 0, 0.8, 0.8);
  paint(ctx, K.belly);
  ctx.restore();

  // Body.
  ellipse(ctx, -0.6, -8.8 + bob, 6.6, 4.1);
  paint(ctx, vgrad(ctx, -13 + bob, -4.5 + bob, K.furTop, K.furDark), K.line);
  ellipse(ctx, -0.3, -6.6 + bob, 4.6, 1.5);
  ctx.globalAlpha = 0.85;
  paint(ctx, K.belly);
  ctx.globalAlpha = 1;

  // Near legs in front of the body.
  leg(ctx, -4.6, hipY, legAngle(false, 0), legLen, K.fur);
  leg(ctx, 2.5, hipY, legAngle(true, Math.PI), legLen, K.fur);

  // Neck.
  ellipse(ctx, 3.9, -11.2 + bob, 2.3, 3.4, 0.45);
  paint(ctx, K.fur);

  // Head.
  ctx.save();
  ctx.translate(5.6, -14 + bob);
  ctx.rotate(run ? Math.sin(phase * 2) * 0.04 : pose === 'jump' ? -0.12 : pose === 'fall' ? 0.1 : 0);
  const twitch = time % 2.6 < 0.15 ? -0.35 : 0;
  for (const [ex, rot] of [[-1.6, -0.75 + twitch], [0.3, -0.35]]) {
    ctx.save();
    ctx.translate(ex, -2.8);
    ctx.rotate(rot);
    ellipse(ctx, 0, -2.2, 1.35, 2.9);
    paint(ctx, K.fur, K.line);
    ellipse(ctx, 0, -2.1, 0.65, 1.9);
    paint(ctx, K.ear);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, 4.4, 4);
  paint(ctx, vgrad(ctx, -4, 4, K.furTop, K.fur), K.line);
  // Snout and nose.
  ellipse(ctx, 3.5, 1.3, 2.7, 1.95, 0.1);
  paint(ctx, K.belly, K.line);
  ellipse(ctx, 5.9, 0.7, 0.95, 0.75);
  paint(ctx, K.nose);
  ctx.strokeStyle = K.line;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.arc(4.4, 2, 0.8, 0.2, Math.PI - 0.6);
  ctx.stroke();
  // Big shiny eye; blinks every few seconds.
  if (pose === 'dead') {
    ctx.strokeStyle = K.eye;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0.4, -1.8);
    ctx.lineTo(2.4, 0.2);
    ctx.moveTo(2.4, -1.8);
    ctx.lineTo(0.4, 0.2);
    ctx.stroke();
  } else {
    const blink = time % 3.3 < 0.12 ? 0.15 : 1;
    ellipse(ctx, 1.4, -0.7, 1.3, 1.7 * blink);
    paint(ctx, K.eye);
    if (blink === 1) {
      ctx.fillStyle = '#ffffff';
      circle(ctx, 1.9, -1.4, 0.55);
      ctx.fill();
      circle(ctx, 1.0, -0.1, 0.25);
      ctx.fill();
    }
  }
  ellipse(ctx, 2.2, 1.6, 1.1, 0.6);
  paint(ctx, K.blush);
  ctx.restore();

  ctx.restore();
}

// ------------------------------------------------------------ ayam jago

const A = {
  line: '#6a2e1a',
  body: '#e8743c',
  bodyDark: '#b84a26',
  neck: '#f6b64c',
  wing: '#c4542c',
  tail: ['#2f6d5a', '#3f8a6e', '#25584a'],
  comb: '#e8433a',
  beak: '#f5b53a',
  leg: '#f0a830',
};

export function drawAyam(ctx: Ctx, x: number, y: number, facing: number, time: number, pecking: boolean, squashed: boolean): void {
  if (!squashed) groundShadow(ctx, x, y + 0.3, 13);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * (squashed ? 1.3 : 1), squashed ? 0.4 : 1);
  const step = time * 10;
  const walking = !pecking && !squashed;
  const bob = walking ? -Math.abs(Math.sin(step)) * 0.8 : 0;

  // Legs.
  ctx.lineCap = 'round';
  for (const [lx, off] of [[-1.3, 0], [1.4, Math.PI]]) {
    const a = walking ? Math.sin(step + off) * 0.5 : 0;
    const fx = lx + Math.sin(a) * 4.2;
    ctx.strokeStyle = A.leg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, -4.3 + bob);
    ctx.lineTo(fx, -0.2);
    ctx.lineTo(fx + 1.5, -0.1);
    ctx.stroke();
  }

  // Tail feathers fan out behind.
  A.tail.forEach((color, i) => {
    ctx.save();
    ctx.translate(-4.2, -9 + bob);
    ctx.rotate(-1.1 + i * 0.4 + Math.sin(time * 3 + i) * 0.05);
    ellipse(ctx, 0, -3.2, 1.5, 3.8);
    paint(ctx, color, '#163a30');
    ctx.restore();
  });

  ellipse(ctx, 0, -7.6 + bob, 5.3, 4.2);
  paint(ctx, vgrad(ctx, -12, -3.5, A.body, A.bodyDark), A.line);
  ellipse(ctx, -0.8, -7.6 + bob, 3.2, 2.2, 0.25);
  paint(ctx, A.wing, A.line, 0.4);

  // Head dips down and forward to peck.
  const peck = pecking ? Math.abs(Math.sin(time * 9)) : 0;
  ctx.save();
  ctx.translate(3.6 + peck * 2.2, -12.2 + bob + peck * 5.2);
  ctx.rotate(peck * 0.9);
  ellipse(ctx, -1, 2.2, 2.2, 3.1, 0.35);
  paint(ctx, A.neck);
  for (const [cx, cy, r] of [[-0.9, -2.6, 1], [0.4, -3, 1.15], [1.6, -2.5, 0.9]]) {
    circle(ctx, cx, cy, r);
    paint(ctx, A.comb, '#9a2420', 0.4);
  }
  ellipse(ctx, 0, 0, 2.7, 2.6);
  paint(ctx, A.neck, A.line);
  ctx.beginPath();
  ctx.moveTo(2.3, -0.5);
  ctx.lineTo(4.7, 0.3);
  ctx.lineTo(2.3, 1);
  ctx.closePath();
  paint(ctx, A.beak, '#a86a1a', 0.35);
  ellipse(ctx, 2.2, 1.9, 0.75, 1.1);
  paint(ctx, A.comb);
  circle(ctx, 1, -0.6, 0.75);
  paint(ctx, '#1e1410');
  ctx.fillStyle = '#ffffff';
  circle(ctx, 1.25, -0.9, 0.3);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ------------------------------------------------------------ lebah

export function drawLebah(ctx: Ctx, x: number, y: number, facing: number, time: number, dead: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, dead ? -1 : 1);
  const flap = dead ? 0.3 : 0.35 + Math.abs(Math.sin(time * 38)) * 0.65;

  // Translucent wings.
  for (const [wx, rot] of [[-1.2, -0.35], [1.2, 0.2]]) {
    ctx.save();
    ctx.translate(wx, -3);
    ctx.rotate(rot);
    ctx.scale(1, flap);
    ellipse(ctx, 0, -2.6, 2.1, 3.2);
    paint(ctx, 'rgba(235,248,255,0.7)', 'rgba(130,175,210,0.9)', 0.4);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(-4.4, -0.6);
  ctx.lineTo(-6.6, 0.2);
  ctx.lineTo(-4.4, 0.9);
  ctx.closePath();
  paint(ctx, '#3a2a1a');

  ellipse(ctx, 0, 0, 4.6, 3.6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, -3.6, 3.6, '#ffe169', '#f0a820');
  ctx.fillRect(-5, -4, 10, 8);
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-2.4, -4, 1.4, 8);
  ctx.fillRect(0.6, -4, 1.4, 8);
  ctx.restore();
  ellipse(ctx, 0, 0, 4.6, 3.6);
  ctx.strokeStyle = '#4a3418';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  circle(ctx, 4.3, -0.4, 2.4);
  paint(ctx, '#3a2a1a');
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(4.6, -2.6);
  ctx.quadraticCurveTo(5.4, -4.6, 6.6, -4.4);
  ctx.stroke();
  circle(ctx, 6.7, -4.4, 0.45);
  ctx.fillStyle = '#3a2a1a';
  ctx.fill();
  circle(ctx, 5.1, -0.9, 1.15);
  paint(ctx, '#ffffff');
  circle(ctx, 5.45, -0.8, 0.6);
  paint(ctx, '#1a120c');
  ellipse(ctx, 4.9, 1.1, 0.7, 0.4);
  paint(ctx, 'rgba(255,140,140,0.6)');
  ctx.restore();
}

// ------------------------------------------------------------ buaya

const B = {
  line: '#2d5a2a',
  top: '#86c463',
  bottom: '#3f7a3a',
  bump: '#4d8a40',
  belly: '#cfe39a',
};

/** Drawn around the centre of its back: (x, y) is the top surface the kancil stands on. */
export function drawBuaya(ctx: Ctx, x: number, y: number, facing: number, time: number, angry: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const g = vgrad(ctx, -2, 8, B.top, B.bottom);

  // Tail sways in the water.
  const sway = Math.sin(time * 2.2) * 0.8;
  ctx.beginPath();
  ctx.moveTo(-8, -0.6);
  ctx.quadraticCurveTo(-13, -0.2 + sway, -17, 2 + sway);
  ctx.quadraticCurveTo(-13, 4 + sway, -8, 6);
  ctx.closePath();
  paint(ctx, g, B.line);

  roundRect(ctx, -10, -1.4, 19, 8.5, 4);
  paint(ctx, g, B.line);
  for (let bx = -12; bx <= 6; bx += 2.6) {
    circle(ctx, bx, -1.1 + (bx < -9 ? 0.6 : 0), 0.95);
    paint(ctx, B.bump, B.line, 0.35);
  }

  // Long snout.
  roundRect(ctx, 6, -0.8, 11, 5.4, [2.2, 2.8, 2.4, 2]);
  paint(ctx, g, B.line);
  ctx.strokeStyle = B.line;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(8, 2.8);
  ctx.lineTo(16.6, 2.8);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let tx = 9; tx < 16; tx += 1.6) {
    ctx.beginPath();
    ctx.moveTo(tx, 2.8);
    ctx.lineTo(tx + 0.5, 3.8);
    ctx.lineTo(tx + 1, 2.8);
    ctx.fill();
  }
  circle(ctx, 15.4, -0.1, 0.35);
  ctx.fillStyle = B.line;
  ctx.fill();

  // Eye bump with a cute eye; it narrows when the buaya is about to dive.
  circle(ctx, 8.6, -1.9, 2.3);
  paint(ctx, B.top, B.line);
  const blink = time % 4 < 0.12 ? 0.2 : 1;
  ellipse(ctx, 8.9, -2.2, 1.35, 1.35 * blink);
  paint(ctx, '#fffbe8');
  circle(ctx, 9.3, -2.1, 0.7 * blink);
  ctx.fillStyle = '#1a120c';
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = B.line;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(7.4, -3.9);
    ctx.lineTo(10.4, -3.1);
    ctx.stroke();
  }
  ctx.restore();
}
