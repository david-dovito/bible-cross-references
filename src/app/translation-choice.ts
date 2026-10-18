import { useCallback } from 'react';
import { isTranslationId, type TranslationId } from '../core/datasets/ids.ts';
import { readPreference, useStringPreference } from '../shared/lib/preferences.ts';
import { DEFAULT_TRANSLATION_ID, isTranslationAvailable } from '../translations/registry.ts';

/**
 * Which translation to show. The URL decides, so a shared link reads the way its author read it;
 * without one, the reader's own last choice does, and failing that the default translation.
 */

/** URL query parameter holding the translation (`?t=kjv`). */
export const TRANSLATION_PARAM = 't';

/** Key of the stored choice, remembered between visits. */
const PREFERENCE_KEY = 'translation';

/** Whether a stored or linked id names a translation this build can show. */
function isShowable(value: string): value is TranslationId {
  return isTranslationId(value) && isTranslationAvailable(value);
}

/**
 * The translation a URL names, or `null` if it names none this build has (`?t=nasb` on a build
 * without the NASB falls back like an unknown id).
 */
export function translationFromParams(params: URLSearchParams): TranslationId | null {
  const id = params.get(TRANSLATION_PARAM);
  return id !== null && isShowable(id) ? id : null;
}

/** The reader's last choice, outside React (the app starts its download before it renders). */
export function readPreferredTranslation(): TranslationId {
  const stored = readPreference(PREFERENCE_KEY);
  return stored !== null && isShowable(stored) ? stored : DEFAULT_TRANSLATION_ID;
}

/** The same choice, as a preference that lasts between visits. */
export function useTranslationPreference(): readonly [TranslationId, (id: TranslationId) => void] {
  const [stored, store] = useStringPreference(PREFERENCE_KEY, DEFAULT_TRANSLATION_ID);
  const set = useCallback(
    (id: TranslationId) => {
      store(id);
    },
    [store],
  );
  return [isShowable(stored) ? stored : DEFAULT_TRANSLATION_ID, set];
}

/** What the app shows on arrival: the URL's translation, else the reader's, else the default. */
export function initialTranslationId(url: URL): TranslationId {
  return translationFromParams(url.searchParams) ?? readPreferredTranslation();
}
