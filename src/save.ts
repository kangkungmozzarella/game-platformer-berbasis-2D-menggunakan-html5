export interface SaveData {
  /** Number of levels the player may pick (1 = only the first). */
  unlocked: number;
  best: number[];
  allTimun: boolean[];
  music: boolean;
  sfx: boolean;
  vibrate: boolean;
  /** Visual style; switching reloads the page. */
  art: 'modern' | 'pixel';
}

const KEY = 'si-kancil-save-v1';

const DEFAULTS: SaveData = { unlocked: 1, best: [], allTimun: [], music: true, sfx: true, vibrate: true, art: 'modern' };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Private mode or corrupted data: fall back to a fresh save.
  }
  return { ...DEFAULTS, best: [], allTimun: [] };
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable; progress just won't persist.
  }
}
