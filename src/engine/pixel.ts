export type Palette = Record<string, string>;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Turns ASCII pixel art into a canvas. Characters missing from the palette are transparent. */
export function pixelArt(rows: string[], pal: Palette, w = 16, h = 16): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length && x < w; x++) {
      const color = pal[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

/** Small seeded PRNG so procedural art looks the same on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3x5 bitmap digits for crisp score popups at native resolution.
const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
  '+': '000010111010000',
  x: '000101010101000',
};

export function tinyText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, outline = '#1b1210'): void {
  const draw = (ox: number, oy: number, fill: string) => {
    ctx.fillStyle = fill;
    let cx = x + ox;
    for (const ch of text) {
      const g = GLYPHS[ch];
      if (g) {
        for (let i = 0; i < 15; i++) {
          if (g[i] === '1') ctx.fillRect(cx + (i % 3), y + oy + Math.floor(i / 3), 1, 1);
        }
      }
      cx += 4;
    }
  };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) draw(ox, oy, outline);
  draw(0, 0, color);
}

export function tinyTextWidth(text: string): number {
  return text.length * 4 - 1;
}
