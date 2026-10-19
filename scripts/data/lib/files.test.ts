import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractZipTextEntry,
  formatBytes,
  readFileIfExists,
  sha256Hex,
  stripByteOrderMark,
  today,
  writeFileAtomic,
} from './files.ts';

async function scratch(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'files-test-'));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('sha256Hex', () => {
  it('hashes content to the usual hex digest', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex(strToU8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('readFileIfExists', () => {
  it('reads a file that is there', async () => {
    const dir = await scratch();
    await writeFile(join(dir, 'a.txt'), 'hello');
    expect((await readFileIfExists(join(dir, 'a.txt')))?.toString()).toBe('hello');
  });

  it('is undefined for a file that is not', async () => {
    const dir = await scratch();
    expect(await readFileIfExists(join(dir, 'nope.txt'))).toBeUndefined();
  });

  it('passes on a failure that is not "no such file"', async () => {
    const dir = await scratch();
    // A directory is not a file: reading it fails with EISDIR, which must not be swallowed.
    await expect(readFileIfExists(dir)).rejects.toThrow();
  });
});

describe('writeFileAtomic', () => {
  it('writes the file, making its directory', async () => {
    const dir = await scratch();
    const path = join(dir, 'nested', 'deeper', 'out.json');
    await writeFileAtomic(path, '{"a":1}');
    expect(await readFile(path, 'utf8')).toBe('{"a":1}');
  });

  it('leaves no temporary file behind', async () => {
    const dir = await scratch();
    const path = join(dir, 'out.txt');
    await writeFileAtomic(path, 'content');
    expect(await readFileIfExists(`${path}.tmp`)).toBeUndefined();
  });

  it('replaces what was there', async () => {
    const dir = await scratch();
    const path = join(dir, 'out.txt');
    await writeFileAtomic(path, 'first');
    await writeFileAtomic(path, 'second');
    expect(await readFile(path, 'utf8')).toBe('second');
  });

  it('writes bytes as well as text', async () => {
    const dir = await scratch();
    const path = join(dir, 'out.bin');
    await writeFileAtomic(path, Uint8Array.of(1, 2, 3));
    expect([...(await readFile(path))]).toEqual([1, 2, 3]);
  });
});

describe('extractZipTextEntry', () => {
  const archive = zipSync({ 'inner.txt': strToU8('the text'), 'other.txt': strToU8('no') });

  it('reads one named entry as text', () => {
    expect(extractZipTextEntry(archive, 'inner.txt')).toBe('the text');
  });

  it('says which entry is missing rather than returning nothing', () => {
    expect(() => extractZipTextEntry(archive, 'absent.txt')).toThrow(/no entry named "absent.txt"/);
  });
});

describe('stripByteOrderMark', () => {
  it('removes a leading mark', () => {
    expect(stripByteOrderMark('﻿text')).toBe('text');
  });

  it('leaves text that has none', () => {
    expect(stripByteOrderMark('text')).toBe('text');
    expect(stripByteOrderMark('')).toBe('');
  });

  it('removes only the leading one', () => {
    expect(stripByteOrderMark('﻿a﻿b')).toBe('a﻿b');
  });
});

describe('formatBytes', () => {
  it('reads in KB below a megabyte and MB above', () => {
    expect(formatBytes(0)).toBe('0.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(4.4 * 1024 * 1024)).toBe('4.4 MB');
  });
});

describe('today', () => {
  it('is the date, as the pins record it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T22:30:00Z'));
    expect(today()).toBe('2026-10-18');
  });
});
