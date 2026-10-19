import { describe, expect, it, vi } from 'vitest';
import { createCachedLoader } from './cached-loader.ts';

describe('createCachedLoader', () => {
  it('runs the loader once and hands back the same promise', async () => {
    const loader = vi.fn(() => Promise.resolve('value'));
    const cached = createCachedLoader(loader);
    const first = cached.load();
    const second = cached.load();
    expect(first).toBe(second);
    await expect(first).resolves.toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps a rejection until it is reset, then tries again', async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('second try');
    const cached = createCachedLoader(loader);
    await expect(cached.load()).rejects.toThrow('offline');
    await expect(cached.load()).rejects.toThrow('offline');
    expect(loader).toHaveBeenCalledTimes(1);

    cached.reset();
    await expect(cached.load()).resolves.toBe('second try');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('starts afresh after a reset even when it had succeeded', async () => {
    let calls = 0;
    const cached = createCachedLoader(() => Promise.resolve(++calls));
    await expect(cached.load()).resolves.toBe(1);
    cached.reset();
    await expect(cached.load()).resolves.toBe(2);
  });
});
