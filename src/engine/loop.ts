/** Fixed simulation step: physics runs at 60 Hz regardless of the monitor's refresh rate. */
export const STEP = 1 / 60;

export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let acc = 0;

  const frame = (now: number) => {
    // Clamp long pauses (tab switch, breakpoint) so the world doesn't fast-forward.
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
