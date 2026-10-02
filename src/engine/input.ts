export type Action = 'left' | 'right' | 'jump' | 'pause';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyZ: 'jump',
  Escape: 'pause',
  KeyP: 'pause',
};

/** Merges keyboard and on-screen touch buttons into a single set of actions. */
export class Input {
  private keys = new Set<Action>();
  private touch = new Set<Action>();
  private justPressed = new Set<Action>();

  constructor() {
    addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      // Keep arrows and space from scrolling the page.
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.justPressed.add(action);
      this.keys.add(action);
    });
    addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.keys.delete(action);
    });
    addEventListener('blur', () => this.reset());
  }

  down(action: Action): boolean {
    return this.keys.has(action) || this.touch.has(action);
  }

  /** True only on the first simulation step after the action was pressed. */
  pressed(action: Action): boolean {
    return this.justPressed.has(action);
  }

  setTouch(action: Action, on: boolean): void {
    if (on && !this.touch.has(action)) this.justPressed.add(action);
    if (on) this.touch.add(action);
    else this.touch.delete(action);
  }

  endStep(): void {
    this.justPressed.clear();
  }

  reset(): void {
    this.keys.clear();
    this.touch.clear();
    this.justPressed.clear();
  }
}
