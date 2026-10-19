import type { TranslationId } from '../core/datasets/ids.ts';
import type { TranslationManifest } from './translation-manifest.ts';

const TRANSLATIONS: Readonly<Record<TranslationId, TranslationManifest>> = {
  bsb: {
    id: 'bsb',
    name: 'Berean Standard Bible',
    abbreviation: 'BSB',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: { name: 'Public domain', url: 'https://berean.bible/terms.htm' },
    attribution: 'Scripture text: Berean Standard Bible (BSB), dedicated to the public domain.',
    homepage: 'https://berean.bible/',
    access: 'bundled',
  },
  msb: {
    id: 'msb',
    name: 'Majority Standard Bible',
    abbreviation: 'MSB',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: { name: 'Public domain', url: 'https://majoritybible.com/' },
    attribution:
      'Scripture text: Majority Standard Bible (MSB), dedicated to the public domain. It follows ' +
      'the Byzantine Majority Text, close to the Greek behind the KJV and the NKJV.',
    homepage: 'https://majoritybible.com/',
    access: 'bundled',
  },
  kjv: {
    id: 'kjv',
    name: 'King James Version',
    abbreviation: 'KJV',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: {
      name: 'Public domain',
      url: 'https://ebible.org/Scriptures/details.php?id=eng-kjv2006',
    },
    // The United Kingdom is the exception to "public domain", and the app says so wherever the
    // translation is chosen: rights there are a perpetual royal patent, not an expiring copyright.
    attribution:
      'Scripture text: King James Version (Authorized Version), the 1769 text. Public domain in ' +
      'the United States and most of the world; in the United Kingdom rights are vested in the ' +
      'Crown and administered by the Crown’s patentee, Cambridge University Press.',
    homepage: 'https://ebible.org/Scriptures/details.php?id=eng-kjv2006',
    access: 'bundled',
  },
  asv: {
    id: 'asv',
    name: 'American Standard Version',
    abbreviation: 'ASV',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: { name: 'Public domain', url: 'https://ebible.org/Scriptures/details.php?id=eng-asv' },
    attribution:
      'Scripture text: American Standard Version (1901), the text the NASB revised. Public domain.',
    homepage: 'https://ebible.org/Scriptures/details.php?id=eng-asv',
    access: 'bundled',
  },
  web: {
    id: 'web',
    name: 'World English Bible',
    abbreviation: 'WEB',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: { name: 'Public domain', url: 'https://worldenglish.bible/' },
    attribution:
      'Scripture text: World English Bible (WEB), eBible.org edition. Public domain; ' +
      '“World English Bible” is a trademark of eBible.org.',
    homepage: 'https://worldenglish.bible/',
    access: 'bundled',
  },
  nasb: {
    id: 'nasb',
    name: 'New American Standard Bible',
    abbreviation: 'NASB',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: {
      name: '© The Lockman Foundation',
      url: 'https://www.lockman.org/permission-to-quote-copyright-trademark-information/',
    },
    // Lockman's own wording, shown wherever the text is.
    attribution:
      'Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © ' +
      '1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission. All rights ' +
      'reserved. lockman.org',
    homepage: 'https://www.lockman.org/',
    access: 'licensed',
  },
  nkjv: {
    id: 'nkjv',
    name: 'New King James Version',
    abbreviation: 'NKJV',
    language: 'en',
    direction: 'ltr',
    versification: 'kjv',
    license: {
      name: '© Thomas Nelson',
      url: 'https://www.harpercollinschristian.com/permissions/',
    },
    attribution:
      'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. ' +
      'Used by permission. All rights reserved.',
    homepage: 'https://www.thomasnelson.com/',
    access: 'licensed',
  },
};

/** Shown beside a licensed translation's credit: the text is for the reader's own use. */
export const PERSONAL_USE_NOTICE = 'For personal use only.';

/**
 * The licensed translations this build has, from `vite.config.ts`, which lists the files in
 * `data/private/` (the data pipeline builds one dataset per file).
 */
// The data pipeline's Node project loads this file without Vite's `env`, hence the optional chain.
const BUILT_LICENSED_IDS: readonly string[] = (
  (import.meta as { env?: { BIBLE_LICENSED?: string } }).env?.BIBLE_LICENSED ?? ''
)
  .split(',')
  .filter((id) => id !== '');

/** Whether this build holds the licensed text itself (a file David supplied when it was built). */
export function isLicensedTextBuilt(id: TranslationId): boolean {
  return BUILT_LICENSED_IDS.includes(id);
}

/**
 * Whether the app can show a translation: bundled ones always; licensed ones once built, or once
 * the reader has loaded their own copy into this browser (`own-texts.ts`).
 */
export function isTranslationAvailable(
  id: TranslationId,
  builtLicensedIds: readonly string[] = BUILT_LICENSED_IDS,
  ownIds: readonly string[] = [],
): boolean {
  return (
    TRANSLATIONS[id].access !== 'licensed' || builtLicensedIds.includes(id) || ownIds.includes(id)
  );
}

/** The translations a reader can pick, in the order the picker lists them. */
export function availableTranslationManifests(
  builtLicensedIds: readonly string[] = BUILT_LICENSED_IDS,
  ownIds: readonly string[] = [],
): readonly TranslationManifest[] {
  return Object.values(TRANSLATIONS).filter(({ id }) =>
    isTranslationAvailable(id, builtLicensedIds, ownIds),
  );
}

/**
 * The credit line for a translation. A reader's own copy of a licensed text does not carry the
 * publisher's "used by permission" wording (nothing was permitted to this site), only whose it is.
 */
export function attributionOf(manifest: TranslationManifest): string {
  return manifest.access === 'licensed' && !isLicensedTextBuilt(manifest.id)
    ? `Your own copy of the ${manifest.name}. ${manifest.license.name}.`
    : manifest.attribution;
}

/** The licensed translations a reader may load a copy of, whether or not they have yet. */
export function licensedTranslationManifests(): readonly TranslationManifest[] {
  return Object.values(TRANSLATIONS).filter(({ access }) => access === 'licensed');
}

/** Every translation this build can show, in the order the picker lists them. */
export const TRANSLATION_MANIFESTS: readonly TranslationManifest[] =
  availableTranslationManifests();

/** The translation shown when the user has not picked one. */
export const DEFAULT_TRANSLATION_ID: TranslationId = 'bsb';

export function getTranslationManifest(id: TranslationId): TranslationManifest {
  return TRANSLATIONS[id];
}
