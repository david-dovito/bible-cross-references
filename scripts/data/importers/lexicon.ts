import {
  DATASET_SCHEMA_VERSION,
  type DatasetProvenance,
  type ImportNotice,
  type LexiconFile,
} from '../../../src/core/datasets/formats.ts';
import type { LicenseInfo } from '../../../src/core/datasets/metadata.ts';
import { CANONICAL_VERSIFICATION } from '../../../src/core/bible/versification.ts';
import { plainStrongs } from '../../../src/words/lexicon.ts';
import { stripByteOrderMark } from '../lib/files.ts';
import { createNotice } from '../lib/notices.ts';

/**
 * Importer for the lexicon behind "where else is this meaning used" (David, 2026-10-17): for every
 * Hebrew and Greek dictionary word, what it means, which words share its root, and, for a Greek
 * word, the Hebrew words the Septuagint used it for.
 *
 * Three sources, each for what it is free to give:
 *
 * - **Strong's dictionaries** (1890/1894), in Open Scriptures' JSON (CC BY-SA): the definition, the
 *   KJV's renderings, and the derivation ("from G5056 (τέλος)") that the word families are built
 *   from. Every word of both testaments has one.
 * - **Abbott-Smith's Manual Greek Lexicon** (1922, public domain), as STEPBible's TBESG carries it
 *   (CC BY 4.0): the senses it sets in bold ("having reached its end, finished, mature, complete,
 *   perfect"), and its note of the Hebrew the Septuagint translated with the word ("[in LXX
 *   chiefly for שָׁלֵם, תָּמִים]").
 * - **TBESH**, only for its Hebrew dictionary forms (to find the Hebrew those notes name) and its
 *   parts of speech (to tell names apart). Its definitions are the Abridged BDB, which Online Bible
 *   asks permission for, and are never read.
 *
 * Words are keyed by their plain Strong's number (`G5046`, `H8549`): the tagged texts split some
 * numbers by sense (`H1254A`), and every sense of a number shares its entry here.
 */

export interface LexiconImportOptions {
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly provenance: Omit<DatasetProvenance, 'snapshotDate'>;
}

export interface LexiconSources {
  /** Open Scriptures' `strongs-greek-dictionary.js`. */
  readonly strongsGreek: string;
  /** Open Scriptures' `strongs-hebrew-dictionary.js`. */
  readonly strongsHebrew: string;
  /** STEPBible's TBESG (Greek, with Abbott-Smith). */
  readonly greekLexicon: string;
  /** STEPBible's TBESH (Hebrew; forms and parts of speech only). */
  readonly hebrewLexicon: string;
  /** Open Scriptures' Brown-Driver-Briggs (`BrownDriverBriggs.xml`). */
  readonly bdb: string;
  /** Its lexical index (`LexicalIndex.xml`): which BDB entry each Strong's number is. */
  readonly bdbIndex: string;
  /** The KJV with Strong's numbers on its words, one USFM text per book. */
  readonly kjvBooks: readonly string[];
}

/** Most KJV renderings kept for one word, the most frequent first. */
const MAX_RENDERINGS = 12;

/**
 * How the KJV translates each word, counted from the Strong's numbers eBible's edition carries on
 * its words (`\w perfect|strong="G5046"\w*`): the concordance count Blue Letter Bible shows as the
 * "KJV Translation Count".
 */
function kjvRenderings(books: readonly string[]): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const text of books) {
    for (const match of text.matchAll(/\\w ([^|\\]+)\|strong="([^"]+)"\\w\*/g)) {
      const english = (match[1] ?? '').trim();
      for (const strongs of (match[2] ?? '').split(',')) {
        const key = plainStrongs(strongs.trim());
        let row = counts.get(key);
        if (!row) {
          row = new Map();
          counts.set(key, row);
        }
        row.set(english, (row.get(english) ?? 0) + 1);
      }
    }
  }
  // A capital that only starts a sentence ("Peace be unto you") is the same word as "peace";
  // one the word always has (a name) is kept.
  for (const row of counts.values()) {
    for (const [english, count] of [...row]) {
      const lower = english.toLowerCase();
      if (lower !== english && row.has(lower)) {
        row.set(lower, (row.get(lower) ?? 0) + count);
        row.delete(english);
      }
    }
  }
  return counts;
}

/**
 * Brown-Driver-Briggs's senses for each Hebrew word, as an outline ("1. complete, whole, entire ·
 * 2. whole, sound, healthful"), found through the lexical index's cross-reference from the
 * Strong's number to the BDB entry. Where an entry has no numbered senses, its definitions.
 */
function bdbOutlines(bdb: string, index: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const match of bdb.matchAll(/<entry id="([^"]+)"[^>]*>([\s\S]*?)<\/entry>/g)) {
    entries.set(match[1] ?? '', match[2] ?? '');
  }
  // A number can name more than one BDB entry (חֶסֶד is both "kindness" and, rarely, "shame"):
  // the fullest entry is the word's main sense.
  const entryOf = new Map<string, string>();
  for (const match of index.matchAll(/<xref\b[^>]*\bbdb="([^"]+)"[^>]*\bstrong="(\d+)"/g)) {
    const key = `H${String(Number(match[2] ?? ''))}`;
    const id = match[1] ?? '';
    const current = entryOf.get(key);
    if (
      current === undefined ||
      (entries.get(id)?.length ?? 0) > (entries.get(current)?.length ?? 0)
    ) {
      entryOf.set(key, id);
    }
  }
  const clean = (fragment: string) =>
    fragment
      .replace(/<status[\s\S]*?<\/status>/g, '')
      .replace(/<w[^>]*>[\s\S]*?<\/w>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;])/g, '$1')
      .trim();
  const outlines = new Map<string, string>();
  for (const [strongs, id] of entryOf) {
    const body = entries.get(id);
    if (!body) {
      continue;
    }
    // Only the top-level senses: nested ones would make the outline a page.
    const senses = [...body.matchAll(/<sense n="(\d+)">([\s\S]*?)<\/sense>/g)].map(
      (match) => `${match[1] ?? ''}. ${clean(match[2] ?? '')}`,
    );
    const definitions = [...body.matchAll(/<def>([\s\S]*?)<\/def>/g)].map((match) =>
      clean(match[1] ?? ''),
    );
    const outline = senses.length > 0 ? senses.join(' · ') : [...new Set(definitions)].join(', ');
    if (outline !== '') {
      outlines.set(strongs, outline.length > 400 ? `${outline.slice(0, 397)}…` : outline);
    }
  }
  return outlines;
}

interface StrongsEntry {
  readonly lemma?: string;
  readonly translit?: string;
  readonly xlit?: string;
  readonly derivation?: string;
  readonly strongs_def?: string;
  readonly kjv_def?: string;
}

/**
 * A root with more words built on it than this is a preposition or a prefix (σύν, ἐκ, κατά; אֵל in
 * names), and a family drawn through it would hold every compound in the language.
 */
export const MAX_ROOT_CHILDREN = 20;
/** The most words a family lists; the closest come first. */
export const MAX_FAMILY = 30;
/** Longest list of Abbott-Smith's senses kept for a word. */
const MAX_SENSES_LENGTH = 220;

/** The dictionary object in one of Open Scriptures' JavaScript files. */
function parseStrongsScript(text: string, label: string): Record<string, StrongsEntry> {
  const start = text.indexOf('{"');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`Lexicon: ${label} has no dictionary object; the format may have changed.`);
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, StrongsEntry>;
}

/** The numbers a derivation names as this word's roots, in its own language. */
function rootsIn(derivation: string, language: 'G' | 'H'): string[] {
  // "From the base of G5056" and "the same as G2276" are etymology a step removed: τέλος's base
  // also gives ἀνατέλλω ("to rise"), which a reader following "perfect" would not expect.
  const direct = derivation.replace(/(?:the )?(?:base|same) (?:of|as) [GH]0*\d+[^;,]*/g, '');
  const roots = [...direct.matchAll(/([GH])0*(\d+)/g)]
    .filter((match) => match[1] === language)
    .map((match) => `${match[1] ?? ''}${match[2] ?? ''}`);
  return [...new Set(roots)];
}

/** The rows of a STEPBible lexicon: tab-separated, each beginning with its number. */
function lexiconRows(text: string): string[][] {
  return stripByteOrderMark(text)
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((columns) => /^[GH]\d{4}/.test(columns[0] ?? ''));
}

const LEXICON_COLUMN = { strongs: 0, lemma: 3, partOfSpeech: 5, meaning: 7 } as const;

/** A person, a place or a title: names are kept out of other words' families. */
function isNameTag(partOfSpeech: string): boolean {
  return /-[PLT](?![A-Za-z])/.test(partOfSpeech);
}

/** Abbott-Smith's bold senses, without the headword (which is Greek) and without repeats. */
function sensesOf(meaning: string): string {
  const senses: string[] = [];
  for (const match of meaning.matchAll(/<b>(.*?)<\/b>/g)) {
    const sense = (match[1] ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.;:]+|[\s,.;:]+$/g, '');
    if (sense === '' || /[Ͱ-Ͽἀ-῿]/.test(sense) || senses.includes(sense)) {
      continue;
    }
    senses.push(sense);
  }
  let joined = '';
  for (const sense of senses) {
    const next = joined === '' ? sense : `${joined}; ${sense}`;
    if (next.length > MAX_SENSES_LENGTH) {
      break;
    }
    joined = next;
  }
  return joined;
}

const HEBREW_MARKS = /[֑-ׇ͏]/g;
// The class holds a lone combining mark (U+034F) on purpose: it is one of the marks to strip.
// eslint-disable-next-line no-misleading-character-class
const CANTILLATION = /[֑-ֽ֯׀׃͏]/g;
const VOWELS = /[ְ-ׇּׁׂ]/;

/** A Hebrew word's letters alone. */
function consonants(word: string): string {
  return word.replace(HEBREW_MARKS, '').replace(/[^א-ת]/g, '');
}

/** A Hebrew word with its vowels but without accents, as lexicons print it. */
function pointed(word: string): string {
  return word.replace(CANTILLATION, '').replace(/[^ְ-ׇא-ת]/g, '');
}

/**
 * Finds the Hebrew words of an Abbott-Smith Septuagint note. The note prints the Hebrew, not its
 * number, so each form is looked up: pointed as printed first; then by its letters, which a bare
 * root (the note's way of naming a verb) has alone, preferring the verb. A form that still names
 * more than one word is left out rather than guessed.
 */
class HebrewForms {
  readonly #byPointed = new Map<string, Set<string>>();
  readonly #byConsonants = new Map<string, Set<string>>();
  readonly #verbs = new Set<string>();

  add(strongs: string, lemma: string, partOfSpeech: string): void {
    if (partOfSpeech.startsWith('H:V')) {
      this.#verbs.add(strongs);
    }
    for (const [map, key] of [
      [this.#byPointed, pointed(lemma)],
      [this.#byConsonants, consonants(lemma)],
    ] as const) {
      const found = map.get(key) ?? new Set<string>();
      found.add(strongs);
      map.set(key, found);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  find(form: string): string | null | 'ambiguous' {
    const exact = this.#byPointed.get(pointed(form));
    if (exact?.size === 1) {
      return [...exact][0] ?? null;
    }
    const byLetters = this.#byConsonants.get(consonants(form));
    if (!byLetters) {
      return exact ? 'ambiguous' : null;
    }
    if (byLetters.size === 1) {
      return [...byLetters][0] ?? null;
    }
    if (!VOWELS.test(form)) {
      const verbs = [...byLetters].filter((strongs) => this.#verbs.has(strongs));
      if (verbs.length === 1) {
        return verbs[0] ?? null;
      }
    }
    return 'ambiguous';
  }
}

/** The Hebrew forms in an Abbott-Smith entry's Septuagint note ("[in LXX chiefly for …]"). */
function septuagintForms(meaning: string): string[] {
  const note = /\[in LXX([^\]]*)\]/.exec(meaning)?.[1] ?? '';
  const withoutReferences = note.replace(/<ref[^>]*>.*?<\/ref>/g, '');
  return [...withoutReferences.matchAll(/[֐-׿]+/g)].map((match) => match[0]);
}

export function importLexicon(
  sources: LexiconSources,
  { license, attribution, provenance }: LexiconImportOptions,
): LexiconFile {
  const strongs = {
    ...parseStrongsScript(sources.strongsGreek, "Strong's Greek"),
    ...parseStrongsScript(sources.strongsHebrew, "Strong's Hebrew"),
  };
  const entries = new Map<string, StrongsEntry>();
  for (const [key, entry] of Object.entries(strongs)) {
    entries.set(plainStrongs(key), entry);
  }

  // A number is a name only when every sense of it is one: שָׁלוֹם has a row for the place
  // Jehovah-shalom beside its five senses of "peace".
  const nameRows = new Set<string>();
  const wordRows = new Set<string>();
  const hebrewForms = new HebrewForms();
  for (const columns of lexiconRows(sources.hebrewLexicon)) {
    const key = plainStrongs(columns[LEXICON_COLUMN.strongs] ?? '');
    const partOfSpeech = columns[LEXICON_COLUMN.partOfSpeech] ?? '';
    if (isNameTag(partOfSpeech)) {
      nameRows.add(key);
      continue;
    }
    wordRows.add(key);
    hebrewForms.add(key, columns[LEXICON_COLUMN.lemma] ?? '', partOfSpeech);
  }
  const senses = new Map<string, string>();
  const septuagint = new Map<string, Set<string>>();
  let noteForms = 0;
  const ambiguousForms: string[] = [];
  const unknownForms: string[] = [];
  for (const columns of lexiconRows(sources.greekLexicon)) {
    const key = plainStrongs(columns[LEXICON_COLUMN.strongs] ?? '');
    (isNameTag(columns[LEXICON_COLUMN.partOfSpeech] ?? '') ? nameRows : wordRows).add(key);
    const meaning = columns[LEXICON_COLUMN.meaning] ?? '';
    if (!senses.has(key)) {
      const found = sensesOf(meaning);
      if (found !== '') {
        senses.set(key, found);
      }
    }
    for (const form of septuagintForms(meaning)) {
      noteForms += 1;
      const hebrew = hebrewForms.find(form);
      if (hebrew === 'ambiguous') {
        ambiguousForms.push(`${key} ${form}`);
      } else if (hebrew === null) {
        unknownForms.push(`${key} ${form}`);
      } else if (entries.has(hebrew)) {
        const found = septuagint.get(key) ?? new Set<string>();
        found.add(hebrew);
        septuagint.set(key, found);
      }
    }
  }
  if (entries.size === 0 || noteForms === 0) {
    throw new Error('Lexicon: a source had no entries; its format may have changed.');
  }

  const names = new Set([...nameRows].filter((key) => !wordRows.has(key)));

  // Families: a word's roots one step up, and what is built on them two steps down, never through
  // a prolific root and never taking in a name (unless the word is one).
  const roots = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const [key, entry] of entries) {
    const language = key.startsWith('G') ? 'G' : 'H';
    const found = rootsIn(entry.derivation ?? '', language).filter(
      (root) => root !== key && entries.has(root),
    );
    roots.set(key, found);
    for (const root of found) {
      children.set(root, [...(children.get(root) ?? []), key]);
    }
  }
  const prolific = (key: string) => (children.get(key)?.length ?? 0) > MAX_ROOT_CHILDREN;
  const familyOf = (key: string): string[] => {
    const keepName = names.has(key);
    const family = [key];
    const add = (member: string) => {
      if (!family.includes(member) && (keepName || !names.has(member))) {
        family.push(member);
      }
    };
    const tops = [key, ...(roots.get(key) ?? []).filter((root) => !prolific(root))];
    tops.slice(1).forEach(add);
    let frontier = tops.filter((top) => !prolific(top));
    for (let depth = 0; depth < 2; depth += 1) {
      const next: string[] = [];
      for (const parent of frontier) {
        for (const child of children.get(parent) ?? []) {
          if (!family.includes(child)) {
            add(child);
            if (!prolific(child)) {
              next.push(child);
            }
          }
        }
      }
      frontier = next;
    }
    return family.slice(0, MAX_FAMILY);
  };

  const outlines = bdbOutlines(sources.bdb, sources.bdbIndex);
  const kjv = kjvRenderings(sources.kjvBooks);

  const keys = [...entries.keys()].sort((a, b) =>
    a.startsWith(b.charAt(0)) ? Number(a.slice(1)) - Number(b.slice(1)) : a.localeCompare(b),
  );
  const position = new Map(keys.map((key, index) => [key, index]));
  const columns = {
    strongs: [] as string[],
    lemma: [] as string[],
    transliteration: [] as string[],
    definition: [] as string[],
    renderings: [] as string[],
    senses: [] as string[],
    translations: [] as string[],
    occurrences: [] as number[],
    familyOffsets: [0] as number[],
    family: [] as number[],
    equivalentOffsets: [0] as number[],
    equivalents: [] as number[],
  };
  for (const key of keys) {
    const entry = entries.get(key) ?? {};
    columns.strongs.push(key);
    columns.lemma.push(entry.lemma ?? '');
    columns.transliteration.push(entry.translit ?? entry.xlit ?? '');
    columns.definition.push((entry.strongs_def ?? '').replace(/\s+/g, ' ').trim());
    columns.renderings.push((entry.kjv_def ?? '').replace(/^--/, '').replace(/\s+/g, ' ').trim());
    // Greek: Abbott-Smith's senses. Hebrew: Brown-Driver-Briggs's.
    columns.senses.push(senses.get(key) ?? outlines.get(key) ?? '');
    const renderings = [...(kjv.get(key) ?? new Map<string, number>())].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    columns.occurrences.push(renderings.reduce((sum, [, count]) => sum + count, 0));
    columns.translations.push(
      renderings
        .slice(0, MAX_RENDERINGS)
        .map(([english, count]) => `${english} (${String(count)})`)
        .join(', '),
    );
    // The word itself is not stored in its own family: it is always the first member.
    const family = familyOf(key).slice(1);
    columns.family.push(...family.map((member) => position.get(member) ?? -1));
    columns.familyOffsets.push(columns.family.length);
    columns.equivalents.push(
      ...[...(septuagint.get(key) ?? [])].map((hebrew) => position.get(hebrew) ?? -1),
    );
    columns.equivalentOffsets.push(columns.equivalents.length);
  }

  const notices: ImportNotice[] = [
    createNotice(
      'info',
      `Septuagint notes: Hebrew forms that name more than one word, left out (of ${String(noteForms)})`,
      ambiguousForms,
    ),
    createNotice(
      'info',
      'Septuagint notes: Hebrew forms not found in TBESH, left out',
      unknownForms,
    ),
  ];

  return {
    format: 'lexicon',
    schemaVersion: DATASET_SCHEMA_VERSION,
    versification: CANONICAL_VERSIFICATION.id,
    provenance: { ...provenance, snapshotDate: null },
    notices,
    license,
    attribution,
    entries: columns,
  };
}
