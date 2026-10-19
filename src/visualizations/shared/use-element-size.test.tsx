import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElementSize } from './use-element-size.ts';

let observers: { element: Element; callback: ResizeObserverCallback; disconnected: boolean }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly #callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.#callback = callback;
      }
      observe(element: Element) {
        observers.push({ element, callback: this.#callback, disconnected: false });
      }
      disconnect() {
        for (const entry of observers) {
          entry.disconnected = true;
        }
      }
      unobserve() {
        // Nothing to undo: the fake never subscribes to anything.
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function resizeTo(width: number, height: number): void {
  const observer = observers.at(-1);
  act(() => {
    observer?.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  });
}

describe('useElementSize', () => {
  it('starts at nothing, before the element has been measured', () => {
    const ref = createRef<HTMLElement>();
    expect(renderHook(() => useElementSize(ref)).result.current).toEqual({
      width: 0,
      height: 0,
    });
  });

  it('observes nothing when there is no element yet', () => {
    const ref = createRef<HTMLElement>();
    renderHook(() => useElementSize(ref));
    expect(observers).toHaveLength(0);
  });

  it("reports the element's content box", () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useElementSize(ref));
    resizeTo(800, 600);
    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it('keeps the same object when the size has not changed, so nothing re-renders', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useElementSize(ref));
    resizeTo(100, 50);
    const first = result.current;
    resizeTo(100, 50);
    expect(result.current).toBe(first);
  });

  it('ignores a notification with no entry', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useElementSize(ref));
    act(() => {
      observers.at(-1)?.callback([], {} as ResizeObserver);
    });
    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('stops observing when it goes away', () => {
    const ref = { current: document.createElement('div') };
    renderHook(() => useElementSize(ref)).unmount();
    expect(observers.at(-1)?.disconnected).toBe(true);
  });
});
