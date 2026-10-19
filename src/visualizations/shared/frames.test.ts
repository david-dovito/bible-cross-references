import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animate, FrameScheduler, MAX_PIXEL_RATIO } from './frames.ts';

let frames: (() => void)[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(() => {
      cb(performance.now());
    });
    return frames.length; // 1-based, so no handle is ever 0
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    frames[handle - 1] = () => undefined;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function runFrames(): void {
  const pending = frames;
  frames = [];
  for (const frame of pending) {
    frame();
  }
}

describe('MAX_PIXEL_RATIO', () => {
  it('stops at a ratio worth rendering', () => {
    expect(MAX_PIXEL_RATIO).toBe(2);
  });
});

describe('FrameScheduler', () => {
  it('draws once however many times it is asked within a frame', () => {
    const render = vi.fn();
    const scheduler = new FrameScheduler(render);
    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(render).not.toHaveBeenCalled();
    runFrames();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('draws again once the frame it asked for has passed', () => {
    const render = vi.fn();
    const scheduler = new FrameScheduler(render);
    scheduler.request();
    runFrames();
    scheduler.request();
    runFrames();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('does not draw after it is disposed', () => {
    const render = vi.fn();
    const scheduler = new FrameScheduler(render);
    scheduler.request();
    scheduler.dispose();
    runFrames();
    expect(render).not.toHaveBeenCalled();
  });

  it('can be disposed when nothing is pending', () => {
    const scheduler = new FrameScheduler(vi.fn());
    expect(() => {
      scheduler.dispose();
    }).not.toThrow();
  });
});

describe('animate', () => {
  it('eases out and finishes at exactly 1', () => {
    const seen: number[] = [];
    animate(0, (progress) => seen.push(progress));
    runFrames();
    expect(seen.at(-1)).toBe(1);
  });

  it('keeps asking for frames until the time is up', () => {
    const seen: number[] = [];
    animate(10_000, (progress) => seen.push(progress));
    runFrames();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeLessThan(1);
    runFrames(); // it asked for another
    expect(seen.length).toBeGreaterThan(1);
  });

  it('eases rather than running linearly', () => {
    // Half way through a 100ms animation, an ease-out curve is already past half.
    const seen: number[] = [];
    let now = 1000;
    vi.stubGlobal('performance', { now: () => now });
    const captured: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => captured.push(cb));
    animate(100, (progress) => seen.push(progress));
    now = 1050;
    captured[0]?.(now);
    expect(seen[0]).toBeCloseTo(1 - 0.5 ** 3, 5);
    expect(seen[0]).toBeGreaterThan(0.5);
  });

  it('stops when cancelled', () => {
    const onFrame = vi.fn();
    const cancel = animate(10_000, onFrame);
    cancel();
    runFrames();
    expect(onFrame).not.toHaveBeenCalled();
  });
});
