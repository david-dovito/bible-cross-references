/**
 * The handoff from the loading screen to the explorer (David, 2026-10-18: "This animation should
 * run to finish - it only last .5sec roughly"). On a fast connection the data arrived half a
 * second in, and the loading arcs were cut off mid-flight. Now, once the data is here, the
 * loading screen launches no more arcs and lets the ones in the air land; then the explorer
 * takes over and its own intro sweeps the arcs in. Never longer than `MAX_LANDING_MS`.
 */

/** The whole loading animation, from first frame to the start of the fade (David, 2026-10-18). */
export const ANIMATION_MS = 5000;
/** The arcs stop launching this far in, so the last ones land before the fade. */
export const LAST_LAUNCH_MS = 3400;
/** Longest the explorer waits for the loading screen once the data is here. */
export const MAX_LANDING_MS = 6500;

interface LoadingScreen {
  /** Stops launching arcs; settles once every arc in the air has landed. */
  readonly land: () => Promise<void>;
  /** Fades the screen out; settles once it is gone. */
  readonly fade: () => Promise<void>;
  /** When the screen came up, on the `performance.now()` clock. */
  readonly startedAt: number;
}

let screen: LoadingScreen | null = null;

/** The loading screen, while it is on screen; it unregisters when it goes. */
export function registerLoadingScreen(loading: LoadingScreen): () => void {
  screen = loading;
  return () => {
    if (screen === loading) {
      screen = null;
    }
  };
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });

/**
 * Plays the loading animation out, if it is on screen: the arcs launch until `LAST_LAUNCH_MS`,
 * land, the screen holds to `ANIMATION_MS`, then fades into the explorer. At most `MAX_LANDING_MS`.
 */
export function landLoadingArcs(): Promise<void> {
  const current = screen;
  if (!current) {
    return Promise.resolve();
  }
  const sequence = async () => {
    await wait(current.startedAt + LAST_LAUNCH_MS - performance.now());
    await current.land();
    await wait(current.startedAt + ANIMATION_MS - performance.now());
    await current.fade();
  };
  return Promise.race([sequence(), wait(MAX_LANDING_MS)]);
}
