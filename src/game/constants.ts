export const TILE = 16;
/** Internal resolution height; the canvas is scaled up to fit the window. */
export const VIEW_H = 216;
/** Visible width at 16:9, the narrowest view the levels are designed for. */
export const BASE_VIEW_W = 384;
/** Widest view (~22:9); beyond that the game letterboxes. */
export const MAX_VIEW_W = 528;

/** Visible world width. Grows on screens wider than 16:9 so phones fill edge to edge. */
export let VIEW_W = BASE_VIEW_W;

export function setViewWidth(w: number): void {
  VIEW_W = w;
}

export const START_LIVES = 3;
export const MAX_LIVES = 5;

export const SCORE = {
  timun: 10,
  rambutan: 50,
  stomp: 100,
  allTimunBonus: 500,
};
