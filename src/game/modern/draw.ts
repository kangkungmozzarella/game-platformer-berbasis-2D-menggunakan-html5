export type Ctx = CanvasRenderingContext2D;

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function vgrad(ctx: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

export function hgrad(ctx: Ctx, x0: number, x1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

export function rgrad(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Fill the current path, then outline it in a darker tone for the soft cartoon look. */
export function paint(ctx: Ctx, fill: string | CanvasGradient, stroke?: string, width = 0.55): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Soft contact shadow under a character's feet. */
export function groundShadow(ctx: Ctx, x: number, y: number, w: number, alpha = 0.2): void {
  ctx.fillStyle = rgrad(ctx, x, y, w / 2, [[0, `rgba(50,30,15,${alpha})`], [1, 'rgba(50,30,15,0)']]);
  ellipse(ctx, x, y, w / 2, w * 0.13);
  ctx.fill();
}

/** Offscreen canvas drawn at `scale`× so it stays sharp on high-density screens. */
export function hiCanvas(w: number, h: number, scale: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  return [c, ctx];
}
