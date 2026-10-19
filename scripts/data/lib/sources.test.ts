import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findSource, type RawSource } from './sources.ts';
import type * as PathsModule from './paths.ts';

const VALID: RawSource = {
  id: 'bsb',
  description: 'Berean Standard Bible',
  url: 'https://example.org/bsb.txt',
  fileName: 'bsb.txt',
  sha256: 'a'.repeat(64),
  retrievedAt: '2026-01-02',
  license: 'Public domain',
  homepage: 'https://example.org/',
};

/** Points the module at a sources file of our own for the duration of a test. */
async function withSourcesFile(contents: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sources-test-'));
  const path = join(dir, 'sources.json');
  await writeFile(path, JSON.stringify(contents));
  vi.doMock('./paths.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof PathsModule>()),
    SOURCES_FILE: path,
  }));
  // The module reads the path at import time, so it has to be loaded again after the mock.
  vi.resetModules();
  return path;
}

afterEach(() => {
  vi.doUnmock('./paths.ts');
  vi.resetModules();
});

describe('readSources', () => {
  it('reads a well-formed file', async () => {
    await withSourcesFile({ sources: [VALID] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).resolves.toEqual([VALID]);
  });

  it('refuses a checksum that is not a SHA-256', async () => {
    await withSourcesFile({ sources: [{ ...VALID, sha256: 'nope' }] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).rejects.toThrow(/sources\[0\]\.sha256/);
  });

  it('refuses a date that is not a date', async () => {
    await withSourcesFile({ sources: [{ ...VALID, retrievedAt: '2 Jan 2026' }] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).rejects.toThrow(/does not match/);
  });

  it('refuses a file name that could escape the raw directory', async () => {
    await withSourcesFile({ sources: [{ ...VALID, fileName: '../escape.txt' }] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).rejects.toThrow(/does not match/);
  });

  it('refuses a missing field', async () => {
    const withoutHomepage: Record<string, unknown> = { ...VALID };
    delete withoutHomepage['homepage'];
    await withSourcesFile({ sources: [withoutHomepage] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).rejects.toThrow(/sources\[0\]\.homepage/);
  });

  it('refuses two sources with the same ID, which would make a pin ambiguous', async () => {
    await withSourcesFile({ sources: [VALID, { ...VALID, fileName: 'other.txt' }] });
    const { readSources: read } = await import('./sources.ts');
    await expect(read()).rejects.toThrow(/must be unique/);
  });
});

describe('writeSources', () => {
  it('writes them back as formatted JSON, ending in a newline', async () => {
    const path = await withSourcesFile({ sources: [] });
    const { writeSources: write } = await import('./sources.ts');
    await write([VALID]);
    const written = await readFile(path, 'utf8');
    expect(written.endsWith('\n')).toBe(true);
    expect(JSON.parse(written)).toEqual({ sources: [VALID] });
    expect(written).toContain('\n  ');
  });
});

describe('findSource', () => {
  it('finds one by its ID', () => {
    expect(findSource([VALID], 'bsb')).toBe(VALID);
  });

  it('says which ID is missing rather than returning nothing', () => {
    expect(() => findSource([VALID], 'kjv')).toThrow(/no source with ID "kjv"/);
  });
});
