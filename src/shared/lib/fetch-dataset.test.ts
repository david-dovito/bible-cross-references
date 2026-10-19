import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetUnavailableError, fetchDataset, measure } from './fetch-dataset.ts';

function respondWith(body: string, init: ResponseInit = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status: 200, ...init }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDataset', () => {
  it('returns the parsed JSON and a report of the download', async () => {
    respondWith('{"hello":"world"}');
    const { json, report } = await fetchDataset('data/thing.json');
    expect(json).toEqual({ hello: 'world' });
    expect(report.path).toBe('data/thing.json');
    expect(report.url).toBe(`${import.meta.env.BASE_URL}data/thing.json`);
    expect(report.bytes).toBe(17);
    expect(report.downloadMs).toBeGreaterThanOrEqual(0);
    expect(report.parseMs).toBeGreaterThanOrEqual(0);
  });

  it('explains how to generate the datasets when the file is not there', async () => {
    respondWith('not found', { status: 404 });
    await expect(fetchDataset('data/missing.json')).rejects.toBeInstanceOf(DatasetUnavailableError);
    await expect(fetchDataset('data/missing.json')).rejects.toThrow(/HTTP 404/);
    await expect(fetchDataset('data/missing.json')).rejects.toThrow(/npm run data/);
  });

  it('reports a network failure rather than letting it through raw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    );
    await expect(fetchDataset('data/x.json')).rejects.toThrow(/connection refused/);
  });

  it('reports a rejection that is not an Error', async () => {
    // Something that is not an Error: the loader has to describe it rather than crash on it.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new (class extends Object {})() as Error)),
    );
    await expect(fetchDataset('data/x.json')).rejects.toThrow(/network error/);
  });

  it('reports a body that is not JSON', async () => {
    respondWith('<html>a proxy error page</html>');
    await expect(fetchDataset('data/x.json')).rejects.toThrow(/not valid JSON/);
  });

  it('keeps the path on the error, so a caller can say which file', async () => {
    respondWith('', { status: 500 });
    await expect(fetchDataset('data/named.json')).rejects.toMatchObject({
      name: 'DatasetUnavailableError',
      path: 'data/named.json',
    });
  });
});

describe('measure', () => {
  it('returns the value and how long it took', () => {
    const { value, ms } = measure(() => 6 * 7);
    expect(value).toBe(42);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('lets a failure through', () => {
    expect(() =>
      measure(() => {
        throw new Error('inner');
      }),
    ).toThrow('inner');
  });
});
