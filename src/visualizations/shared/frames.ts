/** Largest device pixel ratio rendered; higher ratios cost fill rate for no visible gain. */
export const MAX_PIXEL_RATIO = 2;

/**
 * Coalesces render requests into at most one frame, so the scene is drawn only when something
 * changed (no continuous render loop draining phone batteries).
 */
export class FrameScheduler {
  readonly #render: () => void;
  #frame: number | null = null;

  constructor(render: () => void) {
    this.#render = render;
  }

  request(): void {
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = null;
      this.#render();
    });
  }

  dispose(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }
}

/**
 * Runs `onFrame(progress)` over `durationMs` with an ease-out curve (or ease-in-out, for a
 * movement that should keep an even pace through its middle); returns a cancel function.
 *
 * `maxStepMs` caps how far one frame may move it: a frame that comes late (the page busy with
 * something else) then counts as one ordinary frame, so the animation slows down over a busy
 * stretch instead of jumping past it.
 */
export function animate(
  durationMs: number,
  onFrame: (progress: number) => void,
  {
    maxStepMs = Infinity,
    easing = 'out',
  }: { readonly maxStepMs?: number; readonly easing?: 'out' | 'in-out' } = {},
): () => void {
  let elapsed = 0;
  let last = performance.now();
  let frame = requestAnimationFrame(function step(now) {
    elapsed += Math.min(now - last, maxStepMs);
    last = now;
    const linear = durationMs <= 0 ? 1 : Math.min(elapsed / durationMs, 1);
    onFrame(
      easing === 'out'
        ? 1 - (1 - linear) ** 3
        : linear < 0.5
          ? 4 * linear ** 3
          : 1 - (-2 * linear + 2) ** 3 / 2,
    );
    if (linear < 1) {
      frame = requestAnimationFrame(step);
    }
  });
  return () => {
    cancelAnimationFrame(frame);
  };
}
