import { circle, ellipse, hgrad, paint, rgrad, roundRect, vgrad, type Ctx } from './draw';

export type ItemKind = 'timun' | 'rambutan' | 'ketupat';

/** Soft warm glow behind collectibles so they read against busy backgrounds. */
function glow(ctx: Ctx, r: number): void {
  ctx.fillStyle = rgrad(ctx, 0, 0, r, [[0, 'rgba(255,244,190,0.55)'], [1, 'rgba(255,244,190,0)']]);
  circle(ctx, 0, 0, r);
  ctx.fill();
}

export function drawTimun(ctx: Ctx): void {
  ctx.save();
  ctx.rotate(-0.75);
  roundRect(ctx, -6.6, -2.3, 13.2, 4.6, 2.3);
  paint(ctx, vgrad(ctx, -2.3, 2.3, '#9ee07a', '#3a8a36'), '#24562a');
  ctx.fillStyle = 'rgba(30,80,30,0.45)';
  for (const [bx, by] of [[-4, 0.8], [-1.5, -0.6], [1, 0.9], [3.6, -0.4]]) {
    circle(ctx, bx, by, 0.35);
    ctx.fill();
  }
  roundRect(ctx, -5, -1.7, 9, 0.9, 0.45);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  roundRect(ctx, 6.1, -0.7, 1.8, 1.4, 0.5);
  paint(ctx, '#7a5a2a');
  ctx.restore();
}

export function drawRambutan(ctx: Ctx, time: number): void {
  // Spiky hairs, swaying a touch.
  ctx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.sin(time * 2 + i) * 0.05;
    ctx.strokeStyle = i % 3 === 0 ? '#9ac25a' : '#e8503e';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 3.8, Math.sin(a) * 3.8);
    ctx.quadraticCurveTo(Math.cos(a + 0.2) * 5.6, Math.sin(a + 0.2) * 5.6, Math.cos(a + 0.35) * 6.3, Math.sin(a + 0.35) * 6.3);
    ctx.stroke();
  }
  circle(ctx, 0, 0, 4.3);
  paint(ctx, rgrad(ctx, -1.4, -1.6, 6, [[0, '#ff8a76'], [0.6, '#e03a40'], [1, '#a81f30']]), '#7a1424');
  ellipse(ctx, -1.5, -1.8, 1.4, 0.8, -0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

export function drawKetupat(ctx: Ctx): void {
  // Ribbon tails.
  ctx.strokeStyle = '#7cb342';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.5, 5);
  ctx.quadraticCurveTo(-2, 7.5, -3, 8.4);
  ctx.moveTo(0.5, 5);
  ctx.quadraticCurveTo(2, 7.5, 3.4, 8);
  ctx.stroke();
  ctx.save();
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -4.4, -4.4, 8.8, 8.8, 1.6);
  ctx.restore();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = hgrad(ctx, -6, 6, '#b8dc72', '#5e9a34');
  ctx.fillRect(-7, -7, 14, 14);
  // Woven palm-leaf strips.
  ctx.strokeStyle = 'rgba(240,226,140,0.85)';
  ctx.lineWidth = 1.1;
  for (let i = -8; i <= 8; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i - 6, -6);
    ctx.lineTo(i + 6, 6);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(60,100,30,0.35)';
  for (let i = -8; i <= 8; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i + 6, -6);
    ctx.lineTo(i - 6, 6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -4.4, -4.4, 8.8, 8.8, 1.6);
  ctx.restore();
  ctx.strokeStyle = '#3f6a22';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

export function drawItem(ctx: Ctx, kind: ItemKind, x: number, y: number, time: number, phase: number): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 3 + phase) * 1.4);
  glow(ctx, 9);
  ctx.rotate(Math.sin(time * 2 + phase) * 0.08);
  if (kind === 'timun') drawTimun(ctx);
  else if (kind === 'rambutan') drawRambutan(ctx, time);
  else drawKetupat(ctx);
  ctx.restore();
}

export function drawHeart(ctx: Ctx, x: number, y: number, size: number, filled: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5.5);
  ctx.bezierCurveTo(-7.5, 0.5, -7.5, -6.5, -3.6, -6.5);
  ctx.bezierCurveTo(-1.6, -6.5, -0.4, -5.2, 0, -3.8);
  ctx.bezierCurveTo(0.4, -5.2, 1.6, -6.5, 3.6, -6.5);
  ctx.bezierCurveTo(7.5, -6.5, 7.5, 0.5, 0, 5.5);
  ctx.closePath();
  paint(ctx, filled ? vgrad(ctx, -6.5, 5.5, '#ff7a72', '#d8343c') : 'rgba(120,90,80,0.45)', filled ? '#8a1c24' : 'rgba(90,60,50,0.6)', 0.9);
  if (filled) {
    ellipse(ctx, -3.2, -3.6, 1.6, 1, -0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }
  ctx.restore();
}

/** Umbul-umbul checkpoint: a bent bamboo pole flying a long red-and-white pennant. */
export function drawUmbul(ctx: Ctx, x: number, bottom: number, active: boolean, time: number): void {
  ctx.save();
  ctx.translate(x, bottom);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a7430';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -28);
  ctx.quadraticCurveTo(0.5, -33, 6, -33.5);
  ctx.stroke();
  ctx.strokeStyle = '#e2cc72';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  if (!active) {
    roundRect(ctx, 0.8, -29, 3, 9, 1.4);
    paint(ctx, '#b8a898', '#7a6a5a', 0.4);
    ctx.restore();
    return;
  }
  // The pennant ripples more towards its free end.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push([1.2 + Math.sin(time * 5 - i * 0.45) * 2.2 * t + t * 2, -29.5 + t * 26]);
  }
  const band = (from: number, to: number, color: string) => {
    ctx.beginPath();
    for (let i = from; i <= to; i++) {
      const w = 5.2 * (1 - i / 26);
      ctx.lineTo(pts[i][0] + w, pts[i][1]);
    }
    for (let i = to; i >= from; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    paint(ctx, color);
  };
  band(0, 12, '#e8433a');
  band(12, 24, '#fff7ea');
  ctx.restore();
}

/** Candi bentar: a split brick gate with stepped tops and a janur kuning arch. */
export function drawGapura(ctx: Ctx, cx: number, bottom: number, time: number): void {
  ctx.save();
  ctx.translate(cx, bottom);
  const pillar = (px: number, mirror: boolean) => {
    const tiers: [number, number][] = [[16, 30], [14, 7], [11, 5], [8, 4], [4, 3]];
    let y = 0;
    tiers.forEach(([w, h], i) => {
      y -= h;
      const ox = mirror ? px + 16 - w : px;
      roundRect(ctx, ox, y, w, h + 0.4, i === tiers.length - 1 ? [2, 2, 0, 0] : 0.8);
      paint(ctx, vgrad(ctx, y, y + h, '#de7a58', '#a84a32'), '#6a2a1c', 0.5);
      if (i === 0) {
        ctx.strokeStyle = 'rgba(110,40,25,0.35)';
        ctx.lineWidth = 0.4;
        for (let by = y + 4; by < 0; by += 4) {
          ctx.beginPath();
          ctx.moveTo(ox + 1, by);
          ctx.lineTo(ox + w - 1, by);
          ctx.stroke();
        }
        circle(ctx, ox + w / 2, y + 8, 2.2);
        paint(ctx, '#f2c94c', '#9a6a1a', 0.4);
      }
    });
  };
  pillar(-24, false);
  pillar(8, true);
  // Janur kuning arch with dangling leaves.
  ctx.strokeStyle = '#f2dc7a';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -44);
  ctx.quadraticCurveTo(0, -56, 10, -44);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const ax = -10 + t * 20;
    const ay = -44 - Math.sin(t * Math.PI) * 6;
    const sway = Math.sin(time * 3 + i) * 0.8;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax + sway, ay + 3, ax + sway * 1.5, ay + 6);
    ctx.stroke();
  }
  ctx.restore();
}
