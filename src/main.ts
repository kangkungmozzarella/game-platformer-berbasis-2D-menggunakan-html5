import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SoundSystem } from './engine/audio';
import { Input, type Action } from './engine/input';
import { startLoop } from './engine/loop';
import { drawBackground } from './game/background';
import { START_LIVES, VIEW_H, VIEW_W } from './game/constants';
import { LEVELS } from './game/levels';
import { AYAM_SPR, HEART_EMPTY, HEART_FULL, HERO, TIMUN, toDataUrl } from './game/sprites';
import { World, type Session, type WorldEvent } from './game/world';
import { loadSave, writeSave } from './save';

type Mode = 'menu' | 'playing' | 'paused' | 'complete' | 'gameover' | 'ending';
type ScreenName = 'title' | 'levels' | 'help' | 'settings' | 'pause' | 'complete' | 'gameover' | 'ending';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const canvas = $<HTMLCanvasElement>('#game');
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const input = new Input();
const sound = new SoundSystem();
const save = loadSave();
sound.musicOn = save.music;
sound.sfxOn = save.sfx;

let mode: Mode = 'menu';
let world: World | null = null;
let levelIndex = 0;
const session: Session = { lives: START_LIVES, score: 0 };
let levelStart = { score: 0, lives: START_LIVES };
let menuTime = 0;
const isNative = Capacitor.isNativePlatform();
let touchEnabled = isNative || matchMedia('(pointer: coarse)').matches;

const HEART_FULL_URL = toDataUrl(HEART_FULL, 4);
const HEART_EMPTY_URL = toDataUrl(HEART_EMPTY, 4);
const TIMUN_URL = toDataUrl(TIMUN, 4);

// ------------------------------------------------------------ screens

const screens: Record<ScreenName, HTMLElement> = {
  title: $('#screen-title'),
  levels: $('#screen-levels'),
  help: $('#screen-help'),
  settings: $('#screen-settings'),
  pause: $('#screen-pause'),
  complete: $('#screen-complete'),
  gameover: $('#screen-gameover'),
  ending: $('#screen-ending'),
};

function show(name: ScreenName | null, focus = false): void {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('hidden', key !== name);
  if (name && focus) screens[name].querySelector<HTMLElement>('button:not(:disabled)')?.focus();
}

function setPlayingUi(on: boolean): void {
  $('#hud').classList.toggle('hidden', !on);
  $('#touch').classList.toggle('hidden', !(on && touchEnabled));
  if (!on) $('#banner').classList.add('hidden');
}

function refreshTitle(): void {
  $('#btn-play').textContent = save.unlocked > 1 ? 'Lanjutkan' : 'Mulai';
}

function buildLevelList(): void {
  $('#level-list').innerHTML = LEVELS.map((lv, i) => {
    const locked = i >= save.unlocked;
    const best = save.best[i] ?? 0;
    const meta = locked
      ? 'Terkunci'
      : `Rekor ${best}${save.allTimun[i] ? ` <img src="${TIMUN_URL}" alt="semua timun" style="height:1.2em;vertical-align:middle">` : ''}`;
    return `<button class="level-card" data-level="${i}" ${locked ? 'disabled' : ''}>
      <span class="num">${i + 1}</span><span class="name">${lv.name}</span><span class="meta">${meta}</span>
    </button>`;
  }).join('');
}

function fillStats(target: HTMLElement, rows: [string, string | number][]): void {
  target.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// ------------------------------------------------------------ HUD

function updateHud(): void {
  if (!world) return;
  const slots = Math.max(START_LIVES, session.lives);
  $('#hud-hearts').innerHTML = Array.from({ length: slots }, (_, i) =>
    `<img src="${i < session.lives ? HEART_FULL_URL : HEART_EMPTY_URL}" alt="">`,
  ).join('');
  $('#hud-hearts').setAttribute('aria-label', `Nyawa ${session.lives}`);
  $('#hud-timun').textContent = `${world.stats.timun}/${world.stats.timunTotal}`;
  $('#hud-score').textContent = String(session.score);
  $('#hud-level').textContent = `${levelIndex + 1}. ${LEVELS[levelIndex].name}`;
}

function showBanner(): void {
  const lv = LEVELS[levelIndex];
  const banner = $('#banner');
  $('#banner-level').textContent = `Level ${levelIndex + 1}`;
  $('#banner-name').textContent = lv.name;
  $('#banner-sub').textContent = lv.subtitle;
  // Re-trigger the CSS animation.
  banner.classList.add('hidden');
  void banner.offsetWidth;
  banner.classList.remove('hidden');
}

$('#banner').addEventListener('animationend', () => $('#banner').classList.add('hidden'));
($('#hud-timun-icon') as HTMLImageElement).src = TIMUN_URL;

// ------------------------------------------------------------ game flow

function startLevel(index: number): void {
  levelIndex = index;
  levelStart = { score: session.score, lives: session.lives };
  world = new World(LEVELS[index], session, sound, onWorldEvent);
  mode = 'playing';
  show(null);
  setPlayingUi(true);
  updateHud();
  showBanner();
  sound.music(LEVELS[index].music);
  input.reset();
  (document.activeElement as HTMLElement | null)?.blur();
}

function startRun(index: number): void {
  session.lives = START_LIVES;
  session.score = 0;
  startLevel(index);
}

function restartLevel(): void {
  session.score = levelStart.score;
  session.lives = levelStart.lives;
  startLevel(levelIndex);
}

function pause(): void {
  if (mode !== 'playing' || !world || world.finished) return;
  mode = 'paused';
  input.reset();
  show('pause', true);
}

function resume(): void {
  if (mode !== 'paused') return;
  mode = 'playing';
  show(null);
  input.reset();
  (document.activeElement as HTMLElement | null)?.blur();
}

function toMenu(): void {
  mode = 'menu';
  world = null;
  setPlayingUi(false);
  refreshTitle();
  show('title');
  sound.music('menu');
}

function completeLevel(): void {
  if (!world) return;
  const st = world.stats;
  const record = st.levelScore > (save.best[levelIndex] ?? 0);
  if (record) save.best[levelIndex] = st.levelScore;
  if (st.timun === st.timunTotal) save.allTimun[levelIndex] = true;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  writeSave(save);

  fillStats($('#complete-stats'), [
    ['Timun', `${st.timun}/${st.timunTotal}`],
    ['Rambutan', st.rambutan],
    ['Musuh diinjak', st.stomps],
    ['Skor level', st.levelScore],
    ['Total skor', session.score],
  ]);
  $('#complete-record').classList.toggle('hidden', !record);
  $('#btn-next').textContent = levelIndex + 1 < LEVELS.length ? 'Level Berikutnya' : 'Akhir Cerita';
  mode = 'complete';
  setPlayingUi(false);
  show('complete', true);
}

function onWorldEvent(e: WorldEvent): void {
  if (e === 'hud') updateHud();
  else if (e === 'clear') completeLevel();
  else if (e === 'gameover') {
    mode = 'gameover';
    setPlayingUi(false);
    show('gameover', true);
  }
}

function handleAction(action: string): void {
  switch (action) {
    case 'play':
      startRun(Math.min(save.unlocked, LEVELS.length) - 1);
      break;
    case 'levels':
      buildLevelList();
      show('levels');
      break;
    case 'help':
      show('help');
      break;
    case 'settings':
      show('settings');
      break;
    case 'back':
      show('title');
      break;
    case 'reset-progress':
      if (confirm('Hapus semua progres dan rekor?')) {
        save.unlocked = 1;
        save.best = [];
        save.allTimun = [];
        writeSave(save);
        refreshTitle();
        show('title');
      }
      break;
    case 'resume':
      resume();
      break;
    case 'restart':
      restartLevel();
      break;
    case 'retry':
      session.lives = START_LIVES;
      session.score = levelStart.score;
      startLevel(levelIndex);
      break;
    case 'next':
      if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
      else {
        fillStats($('#ending-stats'), [
          ['Total skor', session.score],
          ['Rekor semua level', save.best.reduce((a, b) => a + (b ?? 0), 0)],
        ]);
        mode = 'ending';
        show('ending', true);
        sound.music('menu');
      }
      break;
    case 'quit':
      toMenu();
      break;
  }
}

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const card = target.closest<HTMLElement>('[data-level]');
  if (card && !(card as HTMLButtonElement).disabled) {
    sound.play('click');
    startRun(Number(card.dataset.level));
    return;
  }
  const btn = target.closest<HTMLElement>('[data-action]');
  if (btn?.dataset.action) {
    sound.play('click');
    handleAction(btn.dataset.action);
  }
});

$('#btn-pause').addEventListener('click', () => pause());

// ------------------------------------------------------------ settings

const musicBoxes = [$<HTMLInputElement>('#opt-music'), $<HTMLInputElement>('#opt-music-pause')];
const sfxBoxes = [$<HTMLInputElement>('#opt-sfx'), $<HTMLInputElement>('#opt-sfx-pause')];

function syncOptions(): void {
  musicBoxes.forEach((b) => (b.checked = save.music));
  sfxBoxes.forEach((b) => (b.checked = save.sfx));
}

musicBoxes.forEach((box) =>
  box.addEventListener('change', () => {
    save.music = box.checked;
    sound.setMusic(save.music);
    writeSave(save);
    syncOptions();
  }),
);
sfxBoxes.forEach((box) =>
  box.addEventListener('change', () => {
    save.sfx = box.checked;
    sound.setSfx(save.sfx);
    writeSave(save);
    syncOptions();
  }),
);

// ------------------------------------------------------------ touch controls

const pad = $('#pad');
const [padLeft, padRight] = Array.from(pad.children) as HTMLElement[];
const padPointers = new Map<number, Action>();

function updatePad(): void {
  const active = new Set(padPointers.values());
  input.setTouch('left', active.has('left'));
  input.setTouch('right', active.has('right'));
  padLeft.classList.toggle('on', active.has('left'));
  padRight.classList.toggle('on', active.has('right'));
}

// One element for both directions so sliding a thumb across switches direction.
function padSide(e: PointerEvent): Action {
  const r = pad.getBoundingClientRect();
  return e.clientX < r.left + r.width / 2 ? 'left' : 'right';
}

pad.addEventListener('pointerdown', (e) => {
  pad.setPointerCapture(e.pointerId);
  padPointers.set(e.pointerId, padSide(e));
  updatePad();
});
pad.addEventListener('pointermove', (e) => {
  if (!padPointers.has(e.pointerId)) return;
  padPointers.set(e.pointerId, padSide(e));
  updatePad();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  pad.addEventListener(type, (e) => {
    padPointers.delete(e.pointerId);
    updatePad();
  });
}

const jumpBtn = $('#btn-jump');
jumpBtn.addEventListener('pointerdown', (e) => {
  jumpBtn.setPointerCapture(e.pointerId);
  input.setTouch('jump', true);
  jumpBtn.classList.add('on');
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  jumpBtn.addEventListener(type, () => {
    input.setTouch('jump', false);
    jumpBtn.classList.remove('on');
  });
}

addEventListener('touchstart', () => {
  if (!touchEnabled) {
    touchEnabled = true;
    if (mode === 'playing') setPlayingUi(true);
  }
}, { passive: true });

const portrait = matchMedia('(orientation: portrait)');
// The Android app is locked to landscape, so the hint only matters in the browser.
const updateRotateHint = () => $('#rotate-hint').classList.toggle('hidden', isNative || !(touchEnabled && portrait.matches));
portrait.addEventListener('change', updateRotateHint);
addEventListener('touchstart', updateRotateHint, { passive: true });
updateRotateHint();

// ------------------------------------------------------------ system events

// Audio may only start after a user gesture.
for (const type of ['pointerdown', 'keydown'] as const) addEventListener(type, () => sound.unlock());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  sound.setSuspended(document.hidden);
});

// Android back button: step back through the game instead of closing the app right away.
if (isNative) {
  void App.addListener('backButton', () => {
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    else if (mode === 'menu' && !screens.title.classList.contains('hidden')) void App.exitApp();
    else if (mode === 'menu') show('title');
    else toMenu();
  });
}

// ------------------------------------------------------------ loop

function drawMenuScene(): void {
  const scroll = menuTime * 40;
  drawBackground(ctx, 'pagi', scroll, 24, menuTime);
  const gy = VIEW_H - 20;
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(0, gy, VIEW_W, VIEW_H - gy);
  ctx.fillStyle = '#5e3820';
  for (let i = 0; i < 48; i++) {
    const x = (((i * 53 - scroll) % VIEW_W) + VIEW_W) % VIEW_W;
    ctx.fillRect(Math.round(x), gy + 7 + ((i * 7) % 11), 2, 1);
  }
  ctx.fillStyle = '#3f8a2e';
  ctx.fillRect(0, gy, VIEW_W, 5);
  ctx.fillStyle = '#5aa83c';
  ctx.fillRect(0, gy, VIEW_W, 3);
  ctx.fillStyle = '#8ad35a';
  ctx.fillRect(0, gy, VIEW_W, 1);
  // The kancil makes off with a cucumber, a rooster in hot pursuit.
  const hop = Math.abs(Math.sin(menuTime * 6)) * 2;
  ctx.drawImage(HERO.run[Math.floor(menuTime * 12) % 4], 200, gy - 15 - Math.round(hop));
  ctx.drawImage(TIMUN, 210, gy - 26 - Math.round(hop));
  const chase = Math.round(Math.sin(menuTime * 0.7) * 14);
  ctx.drawImage(AYAM_SPR.walk[Math.floor(menuTime * 8) % 2], 150 + chase, gy - 15);
}

startLoop(
  (dt) => {
    if (input.pressed('pause')) {
      if (mode === 'playing') pause();
      else if (mode === 'paused') resume();
    }
    if (mode === 'playing' && world) world.update(dt, input);
    if (mode === 'menu') menuTime += dt;
    input.endStep();
  },
  () => {
    if (world && mode !== 'menu') world.draw(ctx);
    else drawMenuScene();
  },
);

syncOptions();
refreshTitle();
sound.music('menu');

// Dev-only handle for poking at the running game from the browser console.
if (import.meta.env.DEV) Object.assign(window, { kancil: { get world() { return world; }, session, startRun } });
