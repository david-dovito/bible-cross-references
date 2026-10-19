import { isTranslationId, type TranslationId } from '../core/datasets/ids.ts';
import type { TranslationTextFile } from '../core/datasets/formats.ts';
import { readPreference, useStringPreference, writePreference } from '../shared/lib/preferences.ts';
import { importVerseLines } from './verse-lines.ts';

/**
 * Texts under copyright that a reader loads into their own browser. Nothing is uploaded: the file
 * is read here, parsed here, and kept in this browser's IndexedDB (the list of which ones, in the
 * preferences). The site never holds the text and no other reader ever sees it. This is how the
 * NASB and NKJV can be offered without the site publishing them.
 */

const LIST_KEY = 'own-texts';
const DATABASE = 'bible-cross-references';
const STORE = 'own-texts';
/** A Bible is about 4 MB of text; anything much larger is not one. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Fewer verses than this read means the file is not a verse-per-line Bible. */
const MIN_VERSES_READ = 5000;

/** Kept for the visit when IndexedDB is unavailable (private browsing). */
const memory = new Map<TranslationId, TranslationTextFile>();

function parseList(value: string | null): TranslationId[] {
  return (value ?? '').split(',').filter((id): id is TranslationId => isTranslationId(id));
}

/** The licensed translations this browser holds a copy of. */
export function readOwnTextIds(): TranslationId[] {
  try {
    return parseList(readPreference(LIST_KEY));
  } catch {
    return [];
  }
}

/** The same list, as state that updates when a copy is added or removed. */
export function useOwnTextIds(): readonly TranslationId[] {
  const [stored] = useStringPreference(LIST_KEY, '');
  return parseList(stored);
}

function setList(ids: readonly TranslationId[]): void {
  writePreference(LIST_KEY, [...new Set(ids)].join(','));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB is unavailable.'));
    };
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB failed.'));
      };
    });
  } finally {
    database.close();
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface OwnTextResult {
  /** Verses the file gave text for. */
  readonly versesRead: number;
  /** Things the reader should know about the file (lines skipped, verses missing). */
  readonly warnings: readonly string[];
}

/** Reads a verse-per-line file the reader chose, and keeps it in this browser. */
export async function saveOwnText(id: TranslationId, file: File): Promise<OwnTextResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That file is too large to be a Bible text.');
  }
  const text = await file.text();
  const parsed = importVerseLines(text, id, {
    url: 'file on the reader’s device',
    sha256: await sha256Hex(text),
    retrievedAt: new Date().toISOString().slice(0, 10),
    snapshotDate: null,
  });
  const versesRead = parsed.verses.filter((verse) => verse !== '').length;
  if (versesRead < MIN_VERSES_READ) {
    throw new Error(
      `Only ${String(versesRead)} verses could be read. The file needs one verse per line, like “John 3:16 For God so loved…”.`,
    );
  }
  try {
    await transaction('readwrite', (store) => store.put(parsed, id));
  } catch {
    memory.set(id, parsed);
  }
  setList([...readOwnTextIds(), id]);
  return {
    versesRead,
    warnings: parsed.notices
      .filter((notice) => notice.level === 'warning')
      .map((notice) => `${notice.message} (${String(notice.count)})`),
  };
}

/** The text a reader loaded, or `null` if this browser has none (or it was cleared). */
export async function loadOwnText(id: TranslationId): Promise<TranslationTextFile | null> {
  const remembered = memory.get(id);
  if (remembered) {
    return remembered;
  }
  try {
    const stored = await transaction<TranslationTextFile | undefined>(
      'readonly',
      (store) => store.get(id) as IDBRequest<TranslationTextFile | undefined>,
    );
    return stored ?? null;
  } catch {
    return null;
  }
}

/** Forgets a copy: its text and its place in the list. */
export async function removeOwnText(id: TranslationId): Promise<void> {
  memory.delete(id);
  try {
    await transaction('readwrite', (store) => store.delete(id));
  } catch {
    // Nothing stored to remove.
  }
  setList(readOwnTextIds().filter((other) => other !== id));
}
