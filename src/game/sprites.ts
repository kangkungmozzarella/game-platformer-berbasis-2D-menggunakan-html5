import { pixelArt, type Palette } from '../engine/pixel';

// All sprites face right; flipping is done at draw time.

const KANCIL: Palette = {
  k: '#3b2314',
  b: '#a8683a',
  h: '#c4844c',
  l: '#e0b07a',
  w: '#f4ead8',
  e: '#140c08',
  n: '#2a1a12',
};

const kancilTop = (earUp: boolean, eye = 'e') => [
  '................',
  earUp ? '..........k.k...' : '...........k.k..',
  '.........kbkbk..',
  '.........kbhbbk.',
  `........kbb${eye}bbbk`,
  '........kbbbbbbn',
  '..kkkkkkkbwwbkk.',
  '.kbhhbbbbbwwk...',
  'kbbbbbhbbbbbk...',
  'kbblllllllbbk...',
  '.kbllllllllbk...',
  '..kbbkkkkkbbk...',
];

const KANCIL_LEGS = {
  stand: ['..kbk....kbk....', '..kbk....kbk....', '..kk.....kk.....'],
  run1: ['.kbk.....kbk....', 'kbk.......kbk...', 'kk.........kk...'],
  run2: ['..kbk...kbk.....', '..kbk...kbk.....', '..kk....kk......'],
  run3: ['...kbk.kbk......', '...kbk.kbk......', '...kk..kk.......'],
  run4: ['..kbk....kbk....', '.kbk......kbk...', '.kk........kk...'],
  jump: ['.kbbk...kbbk....', '..kk.....kk.....'],
  fall: ['.kbk......kbk...', 'kbk........kbk..', 'k............k..'],
};

const kancil = (legs: string[], earUp = true, eye = 'e') => pixelArt([...kancilTop(earUp, eye), ...legs], KANCIL);

export const HERO = {
  idle: [kancil(KANCIL_LEGS.stand), kancil(KANCIL_LEGS.stand, false)],
  run: [kancil(KANCIL_LEGS.run1), kancil(KANCIL_LEGS.run2), kancil(KANCIL_LEGS.run3), kancil(KANCIL_LEGS.run4)],
  jump: kancil(KANCIL_LEGS.jump),
  fall: kancil(KANCIL_LEGS.fall, false),
  hurt: kancil(KANCIL_LEGS.fall, false, 'k'),
};

const AYAM: Palette = {
  k: '#2b1b17',
  r: '#d83a2e',
  y: '#f2b632',
  o: '#c8642a',
  d: '#8a3a1a',
  g: '#2f6d4a',
  G: '#1f4a33',
  w: '#f2e2c0',
  e: '#140c08',
};

const ayamTop = (headDown: boolean) =>
  headDown
    ? [
        '................',
        '................',
        '................',
        '...........rr...',
        '.Gg.......rrrr..',
        'GggG.....kwwwk..',
        'G.ggg..kkwwewk..',
        '..gggkkoowwwwky.',
        '...ggoooddoowkr.',
        '....kooooddook..',
        '.....kooooook...',
        '......kooook....',
      ]
    : [
        '................',
        '...........rr...',
        '..........rrrr..',
        '..........kwwk..',
        '.........kwwewky',
        '.Gg......kwwwkr.',
        'GggG....kooowk..',
        'G.ggg..kooooook.',
        '..gggkkoodoooook',
        '...ggoooddoooook',
        '....kooooddook..',
        '.....kooooook...',
      ];

const AYAM_LEGS = {
  a: ['.......kyk.yk...', '.......y...y....', '......yy..yy....'],
  b: ['........yky.....', '........y.y.....', '.......yy.yy....'],
};

export const AYAM_SPR = {
  walk: [pixelArt([...ayamTop(false), ...AYAM_LEGS.a], AYAM), pixelArt([...ayamTop(false), ...AYAM_LEGS.b], AYAM)],
  peck: pixelArt([...ayamTop(true), ...AYAM_LEGS.a], AYAM),
};

const LEBAH: Palette = { k: '#1e1a14', y: '#f5c431', w: '#eaf6ff', W: '#a9d4f0', e: '#ffffff' };

export const LEBAH_SPR = [
  pixelArt(
    [
      '.....ww.ww......',
      '....wWwwWww.....',
      '.....wwkww......',
      '...kkkkkkkk.....',
      '..kyykyykyyk....',
      'kkyykyykyyeek...',
      '..kyykyykyyyk...',
      '...kkkkkkkk.....',
    ],
    LEBAH,
    16,
    8,
  ),
  pixelArt(
    [
      '................',
      '................',
      '..wWwwkwwWw.....',
      '...kkkkkkkk.....',
      '..kyykyykyyk....',
      'kkyykyykyyeek...',
      '..kyykyykyyyk...',
      '...kkkkkkkk.....',
    ],
    LEBAH,
    16,
    8,
  ),
];

export const TIMUN = pixelArt(
  [
    '..........kk....',
    '.........kddk...',
    '........kdlgdk..',
    '.......kdlggdk..',
    '......kdlggdk...',
    '.....kdlggdk....',
    '....kdlggdk.....',
    '...kdgggdk......',
    '..kdgggdk.......',
    '..kdggdk........',
    '...kddk.........',
    '....kk..........',
  ],
  { k: '#1d3a1c', d: '#2f7a2c', g: '#4fae3e', l: '#a6e07a' },
  16,
  12,
);

export const RAMBUTAN = pixelArt(
  [
    '.....h.h.h......',
    '....hrrrrrh.....',
    '...hrrwrrrrh....',
    '..hrrwrrrrrrh...',
    '...rrrrrrrrr....',
    '..hrrrrrrrrrh...',
    '...rRrrrrrRr....',
    '....hRRRRRh.....',
    '.....h.g.h......',
    '.......g........',
  ],
  { r: '#d8343c', R: '#8e1c24', h: '#ff8a5c', w: '#ffd0c0', g: '#4a8a2a' },
  16,
  10,
);

export const KETUPAT = pixelArt(
  [
    '.......k........',
    '......kgk.......',
    '.....kgygk......',
    '....kgygygk.....',
    '...kgygygygk....',
    '....kgygygk.....',
    '.....kgygk......',
    '......kgk.......',
    '.......k........',
    '......kgk.......',
    '.....kg.gk......',
  ],
  { k: '#3a4a1a', g: '#7cb342', y: '#e8d77a' },
  16,
  11,
);

const HEART_ROWS = ['.kk.kk..', 'krrkrrk.', 'krwrrrk.', 'krrrrrk.', '.krrrk..', '..krk...', '...k....'];
export const HEART_FULL = pixelArt(HEART_ROWS, { k: '#3a1010', r: '#e2453c', w: '#ffb3a8' }, 8, 7);
export const HEART_EMPTY = pixelArt(HEART_ROWS, { k: '#3a1010', r: '#5a4a46', w: '#6e5e58' }, 8, 7);

/** Scales a sprite up for use as a crisp DOM image in the HUD. */
export function toDataUrl(src: HTMLCanvasElement, scale: number): string {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL();
}

const BUAYA: Palette = {
  k: '#1c2914',
  g: '#4f7a34',
  G: '#7aa64a',
  d: '#3a5a26',
  w: '#efe8cc',
  e: '#f2d14a',
  p: '#1a1a1a',
};

const buaya = (eye: string) =>
  pixelArt(
    [
      '.....................kkk........',
      `...............k..k.k${eye}pk........`,
      '..........k..kGkkGkkgggkkkkkkk..',
      '......kkkkGkkgGggGgggggggggggggk',
      '..kkkkggggGgggggggggggggggggggk.',
      'kkggggggggggggggggggggggwkwkwkk.',
      '.kkdddddddddddddddddddgggggggk..',
      '...kkddddddddddddddddddddddk....',
      '.....kkkkkkkkkkkkkkkkkkkkkk.....',
    ],
    BUAYA,
    32,
    9,
  );

/** Faces right; the second frame is a blink. */
export const BUAYA_SPR = [buaya('e'), buaya('k')];
