import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_TRANSLATION_ID } from '../translations/registry.ts';
import {
  initialTranslationId,
  readPreferredTranslation,
  translationFromParams,
} from './translation-choice.ts';

/** The app runs in a browser; these tests give it just enough of one to store a preference. */
function withStoredPreference(value: string | null): void {
  const store = new Map(value === null ? [] : [['bible-cross-references:translation', value]]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, next: string) => store.set(key, next),
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

const url = (search: string) => new URL(`https://example.org/${search}`);

describe('translationFromParams', () => {
  // Tests run without BIBLE_LICENSED, like a build without the NASB file.
  it('falls back for ?t=nasb on a build without the NASB', () => {
    expect(translationFromParams(new URLSearchParams('t=nasb'))).toBeNull();
    expect(initialTranslationId(url('?t=nasb'))).toBe(DEFAULT_TRANSLATION_ID);
  });

  it('forgets a stored NASB choice on a build without it', () => {
    withStoredPreference('nasb');
    expect(readPreferredTranslation()).toBe(DEFAULT_TRANSLATION_ID);
  });

  it('reads a translation the app has', () => {
    expect(translationFromParams(new URLSearchParams('t=kjv'))).toBe('kjv');
  });

  it('ignores a missing or unknown one', () => {
    expect(translationFromParams(new URLSearchParams(''))).toBeNull();
    expect(translationFromParams(new URLSearchParams('t=nope'))).toBeNull();
    expect(translationFromParams(new URLSearchParams('t='))).toBeNull();
  });
});

describe('readPreferredTranslation', () => {
  it('falls back to the default when nothing is stored, or storage is unavailable', () => {
    withStoredPreference(null);
    expect(readPreferredTranslation()).toBe(DEFAULT_TRANSLATION_ID);
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(readPreferredTranslation()).toBe(DEFAULT_TRANSLATION_ID);
  });

  it('ignores a stored value the app does not know', () => {
    withStoredPreference('nope');
    expect(readPreferredTranslation()).toBe(DEFAULT_TRANSLATION_ID);
  });

  it('reads a stored choice', () => {
    withStoredPreference('kjv');
    expect(readPreferredTranslation()).toBe('kjv');
  });
});

describe('initialTranslationId', () => {
  it('prefers the URL over the stored choice', () => {
    withStoredPreference('kjv');
    expect(initialTranslationId(url('?t=bsb'))).toBe('bsb');
    expect(initialTranslationId(url(''))).toBe('kjv');
  });

  it('falls back to the stored choice when the URL names an unknown one', () => {
    withStoredPreference('kjv');
    expect(initialTranslationId(url('?t=nope'))).toBe('kjv');
  });
});
