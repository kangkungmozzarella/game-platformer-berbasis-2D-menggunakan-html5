import { loadSave } from '../save';

export type ArtStyle = 'modern' | 'pixel';

/** Read once at startup; switching styles reloads the page. */
export const ART: ArtStyle = loadSave().art;
export const MODERN = ART === 'modern';

/** Pixel art snaps to whole pixels; the modern style keeps sub-pixel positions for smooth motion. */
export const snap: (v: number) => number = MODERN ? (v) => v : Math.round;
