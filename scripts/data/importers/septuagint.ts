import { BOOKS, type BookId } from '../../../src/core/bible/books.ts';
import type { VerseIndex } from '../../../src/core/bible/verse-ref.ts';
import { CANONICAL_VERSIFICATION } from '../../../src/core/bible/versification.ts';
import {
  DATASET_SCHEMA_VERSION,
  type DatasetProvenance,
  type ImportNotice,
  type SeptuagintFile,
} from '../../../src/core/datasets/formats.ts';
import type { LicenseInfo } from '../../../src/core/datasets/metadata.ts';
import { plainStrongs } from '../../../src/words/lexicon.ts';
import { createNotice } from '../lib/notices.ts';

/**
 * The Septuagint, as the bridge between the Hebrew of the Old Testament and the Greek of the New
 * (David, 2026-10-17: "trace Hebrew to Greek and Greek to Hebrew with English words").
 *
 * The Greek is Open Scriptures' LxxLemmas (CC BY 4.0): every verse of the Septuagint as its
 * dictionary forms, keyed to their Greek Word List, which gives each form its Strong's number (for
 * words the New Testament shares), an English definition, and its root ("src") and derivatives.
 * No Greek text is read or written; only which words each verse uses.
 *
 * What nobody publishes openly is which Greek verse is which Hebrew verse, let alone which Greek
 * word renders which Hebrew one, so both are worked out here:
 *
 * 1. **Verses.** The Septuagint numbers verses its own way (most Psalms run a number behind, the
 *    second half of Jeremiah is in another order, 2 Esdras is Ezra and Nehemiah). Each Greek chapter
 *    is matched to the Hebrew chapter whose words it shares most, and its verses are lined up with
 *    that chapter's (and its neighbours') in order, as a weighted longest common subsequence. Two
 *    verses "share" a word when the Greek is a known rendering of a Hebrew word in the other.
 *    Known renderings start as Abbott-Smith's Septuagint notes (the lexicon's), and a second pass
 *    adds what the first pass learned.
 * 2. **Words.** Over the lined-up verses, IBM Model 1 (the classic statistical word-alignment
 *    model: expectation-maximisation over which word in one verse accounts for each word in the
 *    other) is trained in both directions. A Hebrew and a Greek word are paired where they share
 *    at least `MIN_SHARED_VERSES` verses and one accounts for at least `MIN_PROBABILITY` of the
 *    other.
 *
 * Only the books of the Hebrew canon are read (the apocrypha have no Hebrew to line up with), and
 * Daniel in Theodotion's version, which follows the Hebrew; Joshua and Judges in Codex Vaticanus.
 */

/** A Septuagint book file and the books of the Hebrew canon it holds. */
export interface SeptuagintBook {
  readonly file: string;
  readonly books: readonly BookId[];
  readonly text: string;
}

/** Which LxxLemmas file holds which book; 2 Esdras is Ezra and Nehemiah together. */
// prettier-ignore
export const SEPTUAGINT_BOOKS: readonly { readonly file: string; readonly books: readonly BookId[] }[] = [
  { file: 'Gen', books: ['Gen'] }, { file: 'Exod', books: ['Exod'] }, { file: 'Lev', books: ['Lev'] },
  { file: 'Num', books: ['Num'] }, { file: 'Deut', books: ['Deut'] }, { file: 'JoshB', books: ['Josh'] },
  { file: 'JudgB', books: ['Judg'] }, { file: 'Ruth', books: ['Ruth'] }, { file: '1Sam', books: ['1Sam'] },
  { file: '2Sam', books: ['2Sam'] }, { file: '1Kgs', books: ['1Kgs'] }, { file: '2Kgs', books: ['2Kgs'] },
  { file: '1Chr', books: ['1Chr'] }, { file: '2Chr', books: ['2Chr'] }, { file: '2Esd', books: ['Ezra', 'Neh'] },
  { file: 'Esth', books: ['Esth'] }, { file: 'Job', books: ['Job'] }, { file: 'Ps', books: ['Ps'] },
  { file: 'Prov', books: ['Prov'] }, { file: 'Eccl', books: ['Eccl'] }, { file: 'Song', books: ['Song'] },
  { file: 'Isa', books: ['Isa'] }, { file: 'Jer', books: ['Jer'] }, { file: 'Lam', books: ['Lam'] },
  { file: 'Ezek', books: ['Ezek'] }, { file: 'DanTh', books: ['Dan'] }, { file: 'Hos', books: ['Hos'] },
  { file: 'Joel', books: ['Joel'] }, { file: 'Amos', books: ['Amos'] }, { file: 'Obad', books: ['Obad'] },
  { file: 'Jonah', books: ['Jonah'] }, { file: 'Mic', books: ['Mic'] }, { file: 'Nah', books: ['Nah'] },
  { file: 'Hab', books: ['Hab'] }, { file: 'Zeph', books: ['Zeph'] }, { file: 'Hag', books: ['Hag'] },
  { file: 'Zech', books: ['Zech'] }, { file: 'Mal', books: ['Mal'] },
];

export interface SeptuagintImportOptions {
  readonly license: LicenseInfo;
  readonly attribution: string;
  readonly provenance: Omit<DatasetProvenance, 'snapshotDate'>;
}

export interface SeptuagintSources {
  readonly books: readonly SeptuagintBook[];
  /** Open Scriptures' `GreekWordList.js`. */
  readonly greekWordList: string;
  /** Every Hebrew word (extended Strong's) and the KJV verses it is in, nothing left out. */
  readonly hebrewVerses: ReadonlyMap<string, ReadonlySet<VerseIndex>>;
  /** Abbott-Smith's notes: a Greek Strong's number and the Hebrew the Septuagint used it for. */
  readonly seeds: ReadonlyMap<string, ReadonlySet<string>>;
  /** Hebrew prepositions, conjunctions, particles and pronouns (plain Strong's), from TBESH. */
  readonly hebrewFunctionWords: ReadonlySet<string>;
}

/** A Hebrew and a Greek word are paired only where both are in at least this many verse pairs. */
export const MIN_SHARED_VERSES = 3;
/** …and where one accounts for at least this share of the other (IBM Model 1, either way)… */
export const MIN_PROBABILITY = 0.1;
/**
 * …and where their verses overlap at least this much (Dice: twice the shared verses over both
 * counts). Without it a word in every other verse (יְהוָה is in 5,500) pairs with whatever often
 * stands near it; with it, τέλειος and תָּמִים (4 shared, 17 and 79) still pair, at 0.083.
 */
export const MIN_DICE = 0.06;
/** Most renderings kept for one word, the most frequent first. */
const MAX_PAIRS_PER_WORD = 8;
/** Words in more verses than this are left out of the lists, as in the words dataset. */
const MAX_VERSES = 1000;
const MODEL_ITERATIONS = 6;
/** Hebrew chapters scored verse by verse for each Greek one, after the bag-of-words shortlist. */
const SHORTLIST = 4;
/** A root with more derivatives than this would draw half the language into a family. */
const MAX_ROOT_DERIVATIVES = 20;

interface WordListEntry {
  readonly pos?: string;
  /** Its Liddell & Scott headword (`e)gw/` for ἐγώ and for its forms μέ, ἡμᾶς). */
  readonly l?: string;
  readonly lemma?: string;
  readonly strong?: string;
  readonly def?: string;
  readonly src?: string;
  readonly deriv?: string;
  readonly v?: string;
}

/**
 * A Greek function word, by the Word List's parts of speech: a pronoun, preposition, conjunction,
 * particle or interjection first (ὁ is "R N"), or an adverb that is also one of those (ἐν is
 * "D P"). They stand beside every word and pair with none, so the word model leaves them out,
 * as it does their Hebrew counterparts.
 */
function isGreekFunctionWord(pos: string | undefined): boolean {
  const parts = (pos ?? '').split(' ');
  const [first] = parts;
  return (
    ['R', 'P', 'C', 'X', 'I'].includes(first ?? '') ||
    (first === 'D' && parts.some((part) => ['P', 'C', 'X', 'R'].includes(part)))
  );
}

function parseWordList(text: string): Record<string, WordListEntry> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('Septuagint: the Greek Word List has no object; its format may have changed.');
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, WordListEntry>;
}

/** The Word List's function words (keys): pronouns, prepositions, conjunctions, particles, "not". */
function functionWordKeys(wordList: Record<string, WordListEntry>): Set<string> {
  const posByHeadword = new Map<string, string>();
  for (const entry of Object.values(wordList)) {
    if (entry.l && entry.pos && !posByHeadword.has(entry.l)) {
      posByHeadword.set(entry.l, entry.pos);
    }
  }
  /**
   * A word's part of speech. A form the Word List lists apart (σοῦ, ἡμῶν, μέ) has none of its own
   * and points at the word it is a form of (`v`) or comes from (`src`), which is followed until
   * one has it, and failing that its Liddell & Scott headword's. A bare ending (-σε) is grammar.
   */
  const partOfSpeech = (key: string): string | undefined => {
    let current: string | undefined = key;
    for (let hop = 0; hop < 4 && current !== undefined; hop += 1) {
      const entry: WordListEntry | undefined = wordList[current];
      if (!entry) {
        return undefined;
      }
      if (entry.lemma?.startsWith('-')) {
        return 'X';
      }
      if (entry.pos) {
        return entry.pos;
      }
      current = entry.v ?? entry.src?.split(/,\s*/)[0];
    }
    // Last, the Liddell & Scott headword it shares with its dictionary word (μέ and ἐγώ).
    const headword = wordList[key]?.l;
    return headword === undefined ? undefined : posByHeadword.get(headword);
  };

  return new Set(
    Object.entries(wordList)
      .filter(([key, entry]) => isGreekFunctionWord(partOfSpeech(key)) || entry.def === 'not')
      .map(([key]) => key),
  );
}

/** The Greek function words by plain Strong's number, for the evidence importer's quotations. */
export function greekFunctionStrongs(greekWordList: string): Set<string> {
  const wordList = parseWordList(greekWordList);
  const found = new Set<string>();
  for (const key of functionWordKeys(wordList)) {
    const strong = wordList[key]?.strong;
    if (strong) {
      found.add(`G${String(Number(strong))}`);
    }
  }
  return found;
}

interface LxxWord {
  readonly key: string;
  readonly lemma: string;
}

/** One Greek verse: its reference, and the distinct words (by Word List key) it uses. */
interface GreekVerse {
  readonly reference: string;
  readonly chapter: string;
  readonly words: readonly number[];
}

/** Interns strings as small integers, so the model's tables can be keyed by number. */
class Ids {
  readonly values: string[] = [];
  readonly #ids = new Map<string, number>();

  id(value: string): number {
    let id = this.#ids.get(value);
    if (id === undefined) {
      id = this.values.length;
      this.values.push(value);
      this.#ids.set(value, id);
    }
    return id;
  }

  get(value: string): number | undefined {
    return this.#ids.get(value);
  }
}

/** How the words of a lined-up verse pair count each other: `t[target][source]`, IBM Model 1. */
function trainModel1(
  pairs: readonly (readonly [readonly number[], readonly number[]])[],
  iterations: number,
): Map<number, Map<number, number>> {
  const NULL = -1;
  // t(target | source); starts uniform over the targets each source is ever seen with.
  const t = new Map<number, Map<number, number>>();
  for (const [sources, targets] of pairs) {
    for (const target of targets) {
      let row = t.get(target);
      if (!row) {
        row = new Map();
        t.set(target, row);
      }
      for (const source of [NULL, ...sources]) {
        row.set(source, 1);
      }
    }
  }
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const counts = new Map<number, Map<number, number>>();
    const totals = new Map<number, number>();
    for (const [sources, targets] of pairs) {
      const withNull = [NULL, ...sources];
      for (const target of targets) {
        const row = t.get(target);
        if (!row) {
          continue;
        }
        let denominator = 0;
        for (const source of withNull) {
          denominator += row.get(source) ?? 0;
        }
        if (denominator === 0) {
          continue;
        }
        let countRow = counts.get(target);
        if (!countRow) {
          countRow = new Map();
          counts.set(target, countRow);
        }
        for (const source of withNull) {
          const share = (row.get(source) ?? 0) / denominator;
          countRow.set(source, (countRow.get(source) ?? 0) + share);
          totals.set(source, (totals.get(source) ?? 0) + share);
        }
      }
    }
    for (const [target, countRow] of counts) {
      const row = t.get(target);
      if (!row) {
        continue;
      }
      for (const [source, count] of countRow) {
        row.set(source, count / (totals.get(source) ?? 1));
      }
    }
  }
  return t;
}

export function importSeptuagint(
  sources: SeptuagintSources,
  { license, attribution, provenance }: SeptuagintImportOptions,
): SeptuagintFile {
  const versification = CANONICAL_VERSIFICATION;
  const wordList = parseWordList(sources.greekWordList);
  const greekIds = new Ids();
  const hebrewIds = new Ids();

  // The Hebrew of every Old Testament verse, by plain Strong's number.
  const otBooks = new Set(BOOKS.filter((book) => book.testament === 'OT').map((book) => book.id));
  const hebrewOf = new Map<VerseIndex, Set<number>>();
  for (const [strongs, verses] of sources.hebrewVerses) {
    if (!strongs.startsWith('H')) {
      continue;
    }
    const id = hebrewIds.id(plainStrongs(strongs));
    for (const verse of verses) {
      let set = hebrewOf.get(verse);
      if (!set) {
        set = new Set();
        hebrewOf.set(verse, set);
      }
      set.add(id);
    }
  }

  // The Greek, verse by verse, book by book.
  const lemmaOf = new Map<string, string>();
  const greekBooks = sources.books.map(({ file, books, text }) => {
    const parsed = JSON.parse(text) as Record<string, readonly LxxWord[]>;
    const verses: GreekVerse[] = Object.entries(parsed).map(([reference, words]) => {
      for (const word of words) {
        if (!lemmaOf.has(word.key)) {
          lemmaOf.set(word.key, word.lemma);
        }
      }
      return {
        reference,
        chapter: reference.split('.').slice(0, -1).join('.'),
        words: [...new Set(words.map((word) => greekIds.id(word.key)))],
      };
    });
    return { file, books, verses };
  });

  // The KJV's verses of each book, chapter by chapter.
  const chaptersOf = (books: readonly BookId[]): number[][] => {
    const chapters: number[][] = [];
    let current: number[] = [];
    let currentKey = '';
    for (let verse = 0; verse < versification.verseCount; verse += 1) {
      const ref = versification.refAt(verse);
      if (!books.includes(ref.book) || !otBooks.has(ref.book)) {
        continue;
      }
      const key = `${ref.book}.${String(ref.chapter)}`;
      if (key !== currentKey) {
        current = [];
        chapters.push(current);
        currentKey = key;
      }
      current.push(verse);
    }
    return chapters;
  };

  /** Lines every Greek verse up with a Hebrew one, using `renders` (Greek id → Hebrew ids). */
  const lineUp = (renders: ReadonlyMap<number, ReadonlySet<number>>) => {
    const pairs: { reference: string; greek: readonly number[]; verse: VerseIndex }[] = [];
    const perBook: string[] = [];
    for (const { file, books, verses } of greekBooks) {
      const chapters = chaptersOf(books);
      const chapterWords = chapters.map(
        (chapter) => new Set(chapter.flatMap((verse) => [...(hebrewOf.get(verse) ?? [])])),
      );
      const similarity = (greek: readonly number[], verse: VerseIndex): number => {
        const hebrew = hebrewOf.get(verse);
        if (!hebrew) {
          return 0;
        }
        let shared = 0;
        for (const word of greek) {
          for (const candidate of renders.get(word) ?? []) {
            if (hebrew.has(candidate)) {
              shared += 1;
              break;
            }
          }
        }
        return shared;
      };
      const byChapter = new Map<string, GreekVerse[]>();
      for (const verse of verses) {
        byChapter.set(verse.chapter, [...(byChapter.get(verse.chapter) ?? []), verse]);
      }
      let aligned = 0;
      for (const greekVerses of byChapter.values()) {
        // The Hebrew chapter it shares most with, and its neighbours (a Greek chapter can span
        // two Hebrew ones: LXX Psalm 9 is Psalms 9 and 10). A shortlist first, as bags of words:
        // how many of the Greek words have a rendering anywhere in the chapter, over the square
        // root of the chapter's vocabulary, so a long chapter does not win for being long.
        const shortlist = chapterWords
          .map((hebrew, index) => {
            let hits = 0;
            for (const { words } of greekVerses) {
              for (const word of words) {
                for (const candidate of renders.get(word) ?? []) {
                  if (hebrew.has(candidate)) {
                    hits += 1;
                    break;
                  }
                }
              }
            }
            return { index, score: hits / Math.sqrt(Math.max(hebrew.size, 1)) };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, SHORTLIST);
        // The shortlist is then scored verse by verse: each Greek verse by the Hebrew verse it
        // shares most with, which is what tells Psalm 50 from Psalm 51.
        let best = 0;
        let bestScore = -1;
        for (const { index } of shortlist) {
          let score = 0;
          for (const { words } of greekVerses) {
            let most = 0;
            for (const verse of chapters[index] ?? []) {
              most = Math.max(most, similarity(words, verse));
            }
            score += most;
          }
          if (score > bestScore) {
            bestScore = score;
            best = index;
          }
        }
        const window = [best - 1, best, best + 1].flatMap((index) => chapters[index] ?? []);
        // Weighted longest common subsequence: verses stay in order, gaps cost nothing, and a
        // pair counts only where enough is shared to be more than chance.
        const scores = greekVerses.map(({ words }) =>
          window.map((verse) => {
            const shared = similarity(words, verse);
            return shared >= 2 || (shared >= 1 && words.length <= 4) ? shared : 0;
          }),
        );
        const n = greekVerses.length;
        const m = window.length;
        const table = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
        for (let i = 1; i <= n; i += 1) {
          for (let j = 1; j <= m; j += 1) {
            const score = scores[i - 1]?.[j - 1] ?? 0;
            const row = table[i] as Float64Array;
            const above = table[i - 1] as Float64Array;
            row[j] = Math.max(
              above[j] ?? 0,
              row[j - 1] ?? 0,
              score > 0 ? (above[j - 1] ?? 0) + score : 0,
            );
          }
        }
        let i = n;
        let j = m;
        while (i > 0 && j > 0) {
          const score = scores[i - 1]?.[j - 1] ?? 0;
          const here = table[i]?.[j] ?? 0;
          if (score > 0 && here === (table[i - 1]?.[j - 1] ?? 0) + score) {
            const greekVerse = greekVerses[i - 1];
            const verse = window[j - 1];
            if (greekVerse && verse !== undefined) {
              pairs.push({ reference: greekVerse.reference, greek: greekVerse.words, verse });
              aligned += 1;
            }
            i -= 1;
            j -= 1;
          } else if (here === (table[i - 1]?.[j] ?? 0)) {
            i -= 1;
          } else {
            j -= 1;
          }
        }
      }
      perBook.push(`${file} ${String(Math.round((aligned / verses.length) * 100))}%`);
    }
    return { pairs, perBook };
  };

  const hebrewFunction = new Set(
    [...sources.hebrewFunctionWords]
      .map((strongs) => hebrewIds.get(strongs))
      .filter((id): id is number => id !== undefined),
  );
  const greekFunction = new Set(
    [...functionWordKeys(wordList)]
      .map((key) => greekIds.get(key))
      .filter((id): id is number => id !== undefined),
  );

  // Pass 1: Abbott-Smith's renderings alone.
  const seeds = new Map<number, Set<number>>();
  for (const [key, entry] of Object.entries(wordList)) {
    const strong = entry.strong ? `G${String(Number(entry.strong))}` : null;
    const hebrew = strong ? sources.seeds.get(strong) : undefined;
    const id = greekIds.get(key);
    if (hebrew && id !== undefined) {
      seeds.set(id, new Set([...hebrew].map((h) => hebrewIds.id(h))));
    }
  }

  const verseCounts = <T extends number>(lists: Iterable<readonly T[]>) => {
    const counts = new Map<T, number>();
    for (const list of lists) {
      for (const item of list) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      }
    }
    return counts;
  };

  const model = (pairs: ReturnType<typeof lineUp>['pairs']) => {
    const hebrewLists = pairs.map(({ verse }) => [...(hebrewOf.get(verse) ?? [])]);
    const greekCounts = verseCounts(pairs.map(({ greek }) => greek));
    const hebrewCounts = verseCounts(hebrewLists);
    const training = pairs.map(
      ({ greek }, index) =>
        [
          (hebrewLists[index] ?? []).filter((word) => !hebrewFunction.has(word)),
          greek.filter((word) => !greekFunction.has(word)),
        ] as const,
    );
    const greekGivenHebrew = trainModel1(training, MODEL_ITERATIONS);
    const hebrewGivenGreek = trainModel1(
      training.map(([hebrew, greek]) => [greek, hebrew] as const),
      MODEL_ITERATIONS,
    );
    // How many verse pairs each Hebrew and Greek word share.
    const shared = new Map<number, Map<number, number>>();
    training.forEach(([hebrew, greek]) => {
      for (const h of hebrew) {
        let row = shared.get(h);
        if (!row) {
          row = new Map();
          shared.set(h, row);
        }
        for (const g of greek) {
          row.set(g, (row.get(g) ?? 0) + 1);
        }
      }
    });
    const found: {
      hebrew: number;
      greek: number;
      count: number;
      toGreek: number;
      toHebrew: number;
    }[] = [];
    for (const [hebrew, row] of shared) {
      for (const [greek, count] of row) {
        if (count < MIN_SHARED_VERSES) {
          continue;
        }
        const toGreek = greekGivenHebrew.get(greek)?.get(hebrew) ?? 0;
        const toHebrew = hebrewGivenGreek.get(hebrew)?.get(greek) ?? 0;
        const dice =
          (2 * count) / ((hebrewCounts.get(hebrew) ?? 0) + (greekCounts.get(greek) ?? 0));
        if (dice >= MIN_DICE && (toGreek >= MIN_PROBABILITY || toHebrew >= MIN_PROBABILITY)) {
          found.push({ hebrew, greek, count, toGreek, toHebrew });
        }
      }
    }
    return { found, greekCounts, hebrewCounts };
  };

  const first = lineUp(seeds);
  // Pass 2: what pass 1 learned, beside the seeds; it reaches the words Abbott-Smith has no note
  // on (most of the Septuagint's own vocabulary), and lines up the verses those words share.
  const learned = new Map<number, Set<number>>(
    [...seeds].map(([greek, hebrew]) => [greek, new Set(hebrew)]),
  );
  for (const { greek, hebrew, count } of model(first.pairs).found) {
    if (count >= MIN_SHARED_VERSES * 2) {
      learned.set(greek, new Set([...(learned.get(greek) ?? []), hebrew]));
    }
  }
  const second = lineUp(learned);
  const { found, greekCounts, hebrewCounts } = model(second.pairs);

  // The lists: the Greek words, where the Septuagint uses each (as KJV verses), and their families.
  const greekVerses = new Map<number, Set<VerseIndex>>();
  for (const { greek, verse } of second.pairs) {
    for (const word of greek) {
      let set = greekVerses.get(word);
      if (!set) {
        set = new Set();
        greekVerses.set(word, set);
      }
      set.add(verse);
    }
  }
  // Every Greek word is listed (a pair can name the commonest, κύριος among them), but where the
  // Septuagint uses it only for words under the cap, as in the words dataset.
  const kept = [...greekVerses.keys()].sort((a, b) =>
    (greekIds.values[a] ?? '').localeCompare(greekIds.values[b] ?? ''),
  );
  const listed = (word: number) => (greekVerses.get(word)?.size ?? 0) <= MAX_VERSES;
  const position = new Map(kept.map((word, index) => [word, index]));

  const derivativesOf = new Map<string, string[]>();
  for (const [key, entry] of Object.entries(wordList)) {
    for (const root of (entry.src ?? '').split(/,\s*/).filter((part) => part !== '')) {
      derivativesOf.set(root, [...(derivativesOf.get(root) ?? []), key]);
    }
  }
  const familyOf = (key: string): string[] => {
    const entry = wordList[key] ?? {};
    const roots = (entry.src ?? '').split(/,\s*/).filter((part) => part !== '');
    const family = new Set<string>(roots);
    for (const derived of (entry.deriv ?? '').split(/,\s*/)) {
      family.add(derived);
    }
    for (const derived of derivativesOf.get(key) ?? []) {
      family.add(derived);
    }
    for (const root of roots) {
      const siblings = derivativesOf.get(root) ?? [];
      if (siblings.length <= MAX_ROOT_DERIVATIVES) {
        siblings.forEach((sibling) => family.add(sibling));
      }
    }
    family.delete(key);
    return [...family];
  };

  const greek = {
    key: [] as string[],
    lemma: [] as string[],
    strongs: [] as string[],
    gloss: [] as string[],
    verseOffsets: [0] as number[],
    verses: [] as number[],
    familyOffsets: [0] as number[],
    family: [] as number[],
  };
  for (const word of kept) {
    const key = greekIds.values[word] ?? '';
    const entry = wordList[key] ?? {};
    greek.key.push(key);
    greek.lemma.push(entry.lemma ?? lemmaOf.get(key) ?? key);
    greek.strongs.push(entry.strong ? `G${String(Number(entry.strong))}` : '');
    greek.gloss.push((entry.def ?? '').trim());
    if (listed(word)) {
      greek.verses.push(...[...(greekVerses.get(word) ?? [])].sort((a, b) => a - b));
    }
    greek.verseOffsets.push(greek.verses.length);
    for (const member of familyOf(key)) {
      const id = greekIds.get(member);
      const at = id === undefined ? undefined : position.get(id);
      if (at !== undefined) {
        greek.family.push(at);
      }
    }
    greek.familyOffsets.push(greek.family.length);
  }

  const pairs = {
    hebrew: [] as string[],
    greek: [] as number[],
    count: [] as number[],
    hebrewVerses: [] as number[],
    greekVerses: [] as number[],
    toGreek: [] as number[],
    toHebrew: [] as number[],
  };
  const rank = (list: typeof found) =>
    list.sort((a, b) => b.count - a.count).slice(0, MAX_PAIRS_PER_WORD);
  const byHebrew = new Map<number, typeof found>();
  const byGreek = new Map<number, typeof found>();
  for (const pair of found) {
    if (!position.has(pair.greek)) {
      continue;
    }
    byHebrew.set(pair.hebrew, [...(byHebrew.get(pair.hebrew) ?? []), pair]);
    byGreek.set(pair.greek, [...(byGreek.get(pair.greek) ?? []), pair]);
  }
  const keep = new Set<(typeof found)[number]>();
  for (const list of [...byHebrew.values(), ...byGreek.values()]) {
    rank(list).forEach((pair) => keep.add(pair));
  }
  for (const pair of [...keep].sort((a, b) => a.hebrew - b.hebrew || b.count - a.count)) {
    pairs.hebrew.push(hebrewIds.values[pair.hebrew] ?? '');
    pairs.greek.push(position.get(pair.greek) ?? -1);
    pairs.count.push(pair.count);
    pairs.hebrewVerses.push(hebrewCounts.get(pair.hebrew) ?? 0);
    pairs.greekVerses.push(greekCounts.get(pair.greek) ?? 0);
    pairs.toGreek.push(Math.round(pair.toGreek * 1000));
    pairs.toHebrew.push(Math.round(pair.toHebrew * 1000));
  }

  const otVerseCount = [...Array(versification.verseCount).keys()].filter((verse) =>
    otBooks.has(versification.refAt(verse).book),
  ).length;
  const greekVerseCount = greekBooks.reduce((sum, book) => sum + book.verses.length, 0);
  const coveredHebrew = new Set(second.pairs.map(({ verse }) => verse)).size;
  const notices: ImportNotice[] = [
    createNotice(
      'info',
      `Greek verses lined up with a Hebrew one: ${String(second.pairs.length)} of ` +
        `${String(greekVerseCount)}, reaching ${String(coveredHebrew)} of the ` +
        `${String(otVerseCount)} Old Testament verses (pass 1: ${String(first.pairs.length)})`,
      second.perBook,
    ),
    createNotice(
      'info',
      `Hebrew and Greek words paired (at least ${String(MIN_SHARED_VERSES)} shared verses, ` +
        `Dice ${String(MIN_DICE)}, ${String(MIN_PROBABILITY * 100)}% either way)`,
      [...keep]
        .slice(0, 5)
        .map(
          (pair) =>
            `${hebrewIds.values[pair.hebrew] ?? ''} ${greek.lemma[position.get(pair.greek) ?? 0] ?? ''}`,
        ),
    ),
  ];
  // The notice's count is the number of pairs, not of examples.
  const examplesNotice = notices[1];
  if (examplesNotice) {
    notices[1] = { ...examplesNotice, count: pairs.hebrew.length };
  }

  return {
    format: 'septuagint',
    schemaVersion: DATASET_SCHEMA_VERSION,
    versification: versification.id,
    provenance: { ...provenance, snapshotDate: null },
    notices,
    license,
    attribution,
    greek,
    pairs,
    alignment: {
      greek: second.pairs.map(({ reference }) => reference),
      verses: second.pairs.map(({ verse }) => verse),
    },
  };
}

/**
 * Each lined-up Old Testament verse's Septuagint Greek, in order: Strong's numbers where the
 * Word List has one, the Word List key otherwise (`lxx:…`, which no New Testament word matches).
 * A KJV verse that two Greek verses were lined up with gets both, in order.
 */
export function septuagintSequences(
  books: readonly SeptuagintBook[],
  greekWordList: string,
  alignment: SeptuagintFile['alignment'],
): Map<VerseIndex, string[]> {
  const wordList = parseWordList(greekWordList);
  const verseOf = new Map<string, VerseIndex>();
  alignment.greek.forEach((reference, at) => {
    const verse = alignment.verses[at];
    if (verse !== undefined) {
      verseOf.set(reference, verse);
    }
  });
  const sequences = new Map<VerseIndex, string[]>();
  for (const { text } of books) {
    const parsed = JSON.parse(text) as Record<string, readonly LxxWord[]>;
    for (const [reference, words] of Object.entries(parsed)) {
      const verse = verseOf.get(reference);
      if (verse === undefined) {
        continue;
      }
      const sequence = sequences.get(verse) ?? [];
      for (const { key } of words) {
        const strong = wordList[key]?.strong;
        sequence.push(strong ? `G${String(Number(strong))}` : `lxx:${key}`);
      }
      sequences.set(verse, sequence);
    }
  }
  return sequences;
}
