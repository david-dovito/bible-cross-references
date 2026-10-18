import type { VersificationId } from '../core/bible/versification.ts';
import type { TranslationId } from '../core/datasets/ids.ts';
import type { LicenseInfo } from '../core/datasets/metadata.ts';

/**
 * Describes a Bible translation plugin. The app never hard-codes translation details; everything
 * it shows about a translation (name, license, attribution) comes from its manifest.
 */
export interface TranslationManifest {
  readonly id: TranslationId;
  readonly name: string;
  readonly abbreviation: string;
  /** BCP 47 language tag, e.g. `en`. */
  readonly language: string;
  readonly direction: 'ltr' | 'rtl';
  /** Verse numbering used by the translation's own text. */
  readonly versification: VersificationId;
  readonly license: LicenseInfo;
  /** Credit line to display wherever the text is shown. */
  readonly attribution: string;
  readonly homepage: string;
  /**
   * How the text is accessed. `bundled`: the data pipeline downloads it against a pin and ships it
   * with the app. `licensed`: a copyrighted text David supplies himself as a file
   * (`data/private/<id>.txt`, git-ignored, never downloaded); a build without the file
   * leaves it out, and the app offers it only when it was built (`isTranslationAvailable`). Its
   * text is shown for personal use only, under the publisher's notice. API-backed and link-only
   * translations can be added as further variants.
   */
  readonly access: 'bundled' | 'licensed';
}
