import { useEffect, useMemo, useState } from 'react';
import { formatPassage, versePassage, type Passage } from '../../../core/bible/passage.ts';
import type { VerseIndex } from '../../../core/bible/verse-ref.ts';
import { ExpandIcon, WordsIcon } from '../../../shared/ui/icons.tsx';
import { formatInteger } from '../../../shared/lib/format.ts';
import { verseTextOrNote } from '../../../translations/verse-text.ts';
import { plainStrongs, type LexiconEntry } from '../../../words/lexicon.ts';
import type { LexiconDataset } from '../../../words/load-lexicon.ts';
import type { OriginalWordsDataset } from '../../../words/load-original-words.ts';
import type { OriginalWord } from '../../../words/original-words.ts';
import type { Connection } from '../connections.ts';
import type { WordLayer } from '../word-layer.ts';
import {
  lexiconIfLoaded,
  lexiconLoader,
  originalWordsIfLoaded,
  originalWordsLoader,
  resetOriginalWords,
} from '../viz-data.ts';
import { PanelSection } from './PanelSection.tsx';
import { ThayerEntry } from './ThayerEntry.tsx';
import type { VizData } from '../viz-data.ts';
import styles from './PassagePanel.module.css';

/** How many of a verse's words to list before the rest are a click away. */
const INITIAL_WORDS = 6;

/**
 * The words are the one part of the app that is not downloaded until it is wanted: a reader who
 * never opens a verse never pays for it. `null` until it arrives, which is when the section
 * appears; a failed download leaves the panel exactly as it was.
 */
function useOriginalWords(): OriginalWordsDataset | null {
  const [words, setWords] = useState<OriginalWordsDataset | null>(originalWordsIfLoaded);
  useEffect(() => {
    if (words) {
      return undefined;
    }
    let current = true;
    originalWordsLoader.load().then(
      (loaded) => {
        if (current) {
          setWords(loaded);
        }
      },
      () => {
        // A download that failed should not settle the question for the whole visit: forgetting
        // it means the next verse the reader opens asks again.
        resetOriginalWords();
      },
    );
    return () => {
      current = false;
    };
  }, [words]);
  return words;
}

/** The lexicon, fetched the first time a word is opened; `null` until then, or if it failed. */
function useLexicon(wanted: boolean): LexiconDataset | null {
  const [lexicon, setLexicon] = useState<LexiconDataset | null>(lexiconIfLoaded);
  useEffect(() => {
    if (lexicon || !wanted) {
      return undefined;
    }
    let current = true;
    lexiconLoader.load().then(
      (loaded) => {
        if (current) {
          setLexicon(loaded);
        }
      },
      () => {
        lexiconLoader.reset();
      },
    );
    return () => {
      current = false;
    };
  }, [lexicon, wanted]);
  return lexicon;
}

/** How many verses of a word's list show before the rest are a click away. */
const INITIAL_WORD_VERSES = 40;

/**
 * The dictionary words of a verse, and the other verses that use them.
 *
 * This is a different kind of link from the cross-references above it, and is kept apart from
 * them on purpose: a cross-reference is somebody's judgement that two passages belong together,
 * while this is the plain fact that they share a word. Rare words first, since a word used in
 * three places says something about those places and one used in a hundred says much less.
 */
export function OriginalWordsSection({
  verse,
  data,
  connections,
  onSelect,
  onWordLayer,
}: {
  readonly verse: VerseIndex;
  readonly data: VizData;
  /** The verse's cross-references, to say which of a word's verses they also reach. */
  readonly connections: readonly Connection[];
  readonly onSelect: (passage: Passage) => void;
  /** The open word's verses, for a visualization to draw; `null` when none is open. */
  readonly onWordLayer?: ((layer: WordLayer | null) => void) | undefined;
}) {
  const words = useOriginalWords();
  const [expanded, setExpanded] = useState(false);
  const [openWord, setOpenWord] = useState<number | null>(null);
  const lexicon = useLexicon(openWord !== null);
  // A word belongs to the verse it was opened on, and its layer goes when it closes.
  useEffect(() => {
    if (openWord === null) {
      onWordLayer?.(null);
    }
  }, [openWord, onWordLayer]);
  useEffect(() => () => onWordLayer?.(null), [onWordLayer]);
  const { versification } = data;

  if (!words) {
    return null;
  }
  const inVerse = words.index.wordsOf(verse);
  if (inVerse.length === 0) {
    return null;
  }
  const language = versification.bookAt(verse).testament === 'OT' ? 'Hebrew' : 'Greek';
  const visible = expanded ? inVerse : inVerse.slice(0, INITIAL_WORDS);

  return (
    <>
      <PanelSection
        id="same-word"
        icon={WordsIcon}
        title="Words"
        description={`${language}, and where else it is used`}
        count={inVerse.length}
        countLabel="words"
      >
        {visible.map((word) => {
          const open = openWord === word.index;
          return (
            <div key={word.strongs} className={styles.group}>
              <button
                type="button"
                className={`${styles.item} ${styles.word}`}
                aria-expanded={open}
                onClick={() => {
                  setOpenWord(open ? null : word.index);
                }}
              >
                <span className={styles.itemRef}>
                  <strong lang={language === 'Hebrew' ? 'he' : 'el'}>{word.lemma}</strong>
                  <span className={styles.wordSound}>{word.transliteration}</span>
                  <span className={styles.count}>{formatInteger(word.verseCount)}</span>
                  <ExpandIcon className={styles.chevron} />
                </span>
                <span className={styles.snippet}>{word.gloss}</span>
              </button>
              {open &&
                (lexicon ? (
                  <WordMeaning
                    word={word}
                    words={words}
                    lexicon={lexicon}
                    verse={verse}
                    data={data}
                    connections={connections}
                    onSelect={onSelect}
                    onWordLayer={onWordLayer}
                  />
                ) : (
                  <WordVerses
                    verses={words.index.versesOf(word.index)}
                    verse={verse}
                    data={data}
                    onSelect={onSelect}
                  />
                ))}
            </div>
          );
        })}
        {!expanded && inVerse.length > INITIAL_WORDS && (
          <button
            type="button"
            className={styles.more}
            onClick={() => {
              setExpanded(true);
            }}
          >
            Show {formatInteger(inVerse.length - INITIAL_WORDS)} more
          </button>
        )}
      </PanelSection>
      {/* Outside the section's body: the credit is a condition of using the data, so it does
          not go away when a reader folds the words out of sight. */}
      <p className={styles.credit}>
        Words:{' '}
        <a href={words.manifest.homepage} target="_blank" rel="noreferrer">
          STEP Bible
        </a>{' '}
        (
        <a href={words.manifest.license.url} target="_blank" rel="noreferrer">
          {words.manifest.license.name}
        </a>
        ), based on work at Tyndale House, Cambridge; reduced to dictionary forms. Words used in
        more than {formatInteger(words.maxVerses)} verses are left out.
        {lexicon && openWord !== null && (
          <>
            {' '}
            {lexicon.attribution} {lexicon.septuagintAttribution}
          </>
        )}
      </p>
    </>
  );
}

/** A list of verses using a word, each a way to that verse. */
function WordVerses({
  verses,
  verse,
  data,
  onSelect,
  alsoLinked,
}: {
  readonly verses: readonly VerseIndex[];
  readonly verse: VerseIndex;
  readonly data: VizData;
  readonly onSelect: (passage: Passage) => void;
  /** Verses the opened one's cross-references also reach, marked as such. */
  readonly alsoLinked?: ReadonlySet<VerseIndex>;
}) {
  const [all, setAll] = useState(false);
  const { versification, translation } = data;
  const shown = all ? verses : verses.slice(0, INITIAL_WORD_VERSES);
  return (
    <>
      {shown.map((other) => (
        <button
          key={other}
          type="button"
          className={`${styles.item} ${styles.wordVerse}`}
          aria-current={other === verse ? 'true' : undefined}
          onClick={() => {
            onSelect(versePassage(other));
          }}
        >
          <span className={styles.itemRef}>
            <strong>{formatPassage(versePassage(other), versification)}</strong>
            {alsoLinked?.has(other) && (
              <span className={styles.alsoLinked}>also a cross-reference</span>
            )}
          </span>
          <span className={styles.snippet}>{verseTextOrNote(translation, other)}</span>
        </button>
      ))}
      {!all && verses.length > INITIAL_WORD_VERSES && (
        <button
          type="button"
          className={`${styles.more} ${styles.wordMore}`}
          onClick={() => {
            setAll(true);
          }}
        >
          Show all {formatInteger(verses.length)}
        </button>
      )}
    </>
  );
}

/** A word a reader can add to what is followed, in either language, with where it is used. */
interface MeaningChoice {
  readonly id: string;
  readonly lemma: string;
  readonly language: 'he' | 'el';
  /** A few words of English. */
  readonly gloss: string;
  /** How it relates to the opened word, e.g. "61 of its 84 verses". */
  readonly note: string;
  readonly definition: string;
  readonly verses: readonly VerseIndex[];
}

const languageOf = (strongs: string): 'he' | 'el' => (strongs.startsWith('H') ? 'he' : 'el');

/** The verses a lexicon word is used in: by the tagged texts, and (Greek) by the Septuagint. */
function versesOfStrongs(
  strongs: string,
  words: OriginalWordsDataset,
  lexicon: LexiconDataset,
): VerseIndex[] {
  const found = new Set<VerseIndex>();
  for (const each of words.index.wordsWithStrongs(strongs)) {
    words.index.versesOf(each.index).forEach((verse) => found.add(verse));
  }
  for (const each of lexicon.septuagint.wordsWithStrongs(strongs)) {
    lexicon.septuagint.versesOf(each).forEach((verse) => found.add(verse));
  }
  return [...found];
}

/** The short English for a word: its tagged gloss if the texts have it, else Strong's. */
function glossOf(strongs: string, words: OriginalWordsDataset, lexicon: LexiconDataset): string {
  const tagged = words.index.wordsWithStrongs(strongs)[0]?.gloss;
  if (tagged) {
    return tagged;
  }
  const definition = lexicon.lexicon.find(strongs)?.definition ?? '';
  return definition.split(/[;,(]/)[0]?.trim() ?? '';
}

/** "61 of its 84 verses": how much of a word's own verses the pairing accounts for. */
function shareNote(count: number, of: number): string {
  return `${formatInteger(count)} of ${formatInteger(of)} verses`;
}

/**
 * The choices beyond the word itself: its family (same root), and its counterparts across the
 * Septuagint: for a Hebrew word, the Greek it was rendered by; for a Greek word, the Greek of the
 * Septuagint itself and the Hebrew it rendered there.
 */
function meaningChoices(
  word: OriginalWord,
  entry: LexiconEntry | null,
  words: OriginalWordsDataset,
  lexicon: LexiconDataset,
): { family: MeaningChoice[]; septuagint: MeaningChoice[] } {
  const family: MeaningChoice[] = (entry ? lexicon.lexicon.familyOf(entry) : []).map((member) => ({
    id: member.strongs,
    lemma: member.lemma,
    language: languageOf(member.strongs),
    gloss: glossOf(member.strongs, words, lexicon),
    note: '',
    definition: member.definition,
    verses: versesOfStrongs(member.strongs, words, lexicon),
  }));

  const plain = plainStrongs(word.strongs);
  const septuagint: MeaningChoice[] = [];
  const seen = new Set<string>();
  if (plain.startsWith('H')) {
    for (const pair of lexicon.septuagint.renderingsOf(plain)) {
      const id = pair.greek.strongs || `lxx:${String(pair.greek.index)}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const verses = new Set(lexicon.septuagint.versesOf(pair.greek));
      if (pair.greek.strongs) {
        versesOfStrongs(pair.greek.strongs, words, lexicon).forEach((verse) => verses.add(verse));
      }
      septuagint.push({
        id,
        lemma: pair.greek.lemma,
        language: 'el',
        gloss: pair.greek.gloss || glossOf(pair.greek.strongs, words, lexicon),
        note: shareNote(pair.count, pair.hebrewVerses),
        definition: lexicon.lexicon.find(pair.greek.strongs)?.definition ?? pair.greek.gloss,
        verses: [...verses],
      });
    }
  } else {
    const ownGreek = lexicon.septuagint.wordsWithStrongs(plain);
    const inSeptuagint = ownGreek.flatMap((each) => [...lexicon.septuagint.versesOf(each)]);
    if (inSeptuagint.length > 0) {
      septuagint.push({
        id: `lxx-self:${plain}`,
        lemma: word.lemma,
        language: 'el',
        gloss: 'in the Septuagint',
        note: `${formatInteger(new Set(inSeptuagint).size)} Old Testament verses`,
        definition: 'Where the Septuagint uses this same Greek word',
        verses: [...new Set(inSeptuagint)],
      });
    }
    const sources = ownGreek.flatMap((each) => [...lexicon.septuagint.sourcesOf(each)]);
    for (const pair of sources) {
      if (seen.has(pair.hebrew)) {
        continue;
      }
      seen.add(pair.hebrew);
      septuagint.push({
        id: pair.hebrew,
        lemma: lexicon.lexicon.find(pair.hebrew)?.lemma ?? pair.hebrew,
        language: 'he',
        gloss: glossOf(pair.hebrew, words, lexicon),
        note: shareNote(pair.count, pair.greekVerses),
        definition: lexicon.lexicon.find(pair.hebrew)?.definition ?? '',
        verses: versesOfStrongs(pair.hebrew, words, lexicon),
      });
    }
    // Abbott-Smith's notes, where the word model found no pairing of its own.
    for (const hebrew of entry ? lexicon.lexicon.equivalentsOf(entry) : []) {
      if (seen.has(hebrew.strongs)) {
        continue;
      }
      seen.add(hebrew.strongs);
      septuagint.push({
        id: hebrew.strongs,
        lemma: hebrew.lemma,
        language: 'he',
        gloss: glossOf(hebrew.strongs, words, lexicon),
        note: 'Abbott-Smith',
        definition: hebrew.definition,
        verses: versesOfStrongs(hebrew.strongs, words, lexicon),
      });
    }
  }
  const used = (choice: MeaningChoice) => choice.verses.length > 0;
  return { family: family.filter(used), septuagint: septuagint.filter(used) };
}

/**
 * An opened word, laid out the way a lexicon page is: what it means (the lexicons' senses, Strong's
 * definition, how the KJV translates it), then where else that meaning is used. The word itself is
 * always followed; its family and its Septuagint counterparts are the reader's to add, one by one,
 * and the verses of everything chosen are listed together and drawn on the arcs.
 */
function WordMeaning({
  word,
  words,
  lexicon,
  verse,
  data,
  connections,
  onSelect,
  onWordLayer,
}: {
  readonly word: OriginalWord;
  readonly words: OriginalWordsDataset;
  readonly lexicon: LexiconDataset;
  readonly verse: VerseIndex;
  readonly data: VizData;
  readonly connections: readonly Connection[];
  readonly onSelect: (passage: Passage) => void;
  readonly onWordLayer?: ((layer: WordLayer | null) => void) | undefined;
}) {
  const entry = lexicon.lexicon.find(word.strongs);
  const { family, septuagint } = useMemo(
    () => meaningChoices(word, entry, words, lexicon),
    [word, entry, words, lexicon],
  );
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const setMany = (ids: readonly string[], on: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const verses = useMemo(() => {
    const found = new Set(words.index.versesOf(word.index));
    for (const choice of [...family, ...septuagint]) {
      if (chosen.has(choice.id)) {
        choice.verses.forEach((other) => found.add(other));
      }
    }
    return [...found].sort((a, b) => a - b);
  }, [words, word.index, family, septuagint, chosen]);

  const alsoLinked = useMemo(() => {
    const linked = new Set<VerseIndex>();
    for (const connection of connections) {
      for (let other = connection.otherStart; other <= connection.otherEnd; other += 1) {
        linked.add(other);
      }
    }
    return new Set(verses.filter((other) => other !== verse && linked.has(other)));
  }, [connections, verses, verse]);

  // Keyed by what the layer holds: a new array of the same verses must not report again, or a
  // visualization that renders on each report would loop.
  const versesKey = verses.join(',');
  useEffect(() => {
    onWordLayer?.({ verse, verses: versesKey === '' ? [] : versesKey.split(',').map(Number) });
  }, [onWordLayer, verse, versesKey]);

  const isHebrew = word.strongs.startsWith('H');
  const others = verses.filter((other) => other !== verse).length;
  return (
    <div className={styles.meaning}>
      {entry && (
        <div className={styles.definition}>
          {entry.senses !== '' && <p className={styles.senses}>{entry.senses}</p>}
          <p>{entry.definition}</p>
          {entry.translations !== '' && (
            <p className={styles.renderings}>
              KJV, {formatInteger(entry.occurrences)}×: {entry.translations}
            </p>
          )}
          <ThayerEntry strongs={plainStrongs(word.strongs)} />
        </div>
      )}
      {family.length > 0 && (
        <MeaningChoices
          title="Same root"
          choices={family}
          chosen={chosen}
          onToggle={(id) => {
            setMany([id], !chosen.has(id));
          }}
          onAll={(on) => {
            setMany(
              family.map((choice) => choice.id),
              on,
            );
          }}
        />
      )}
      {septuagint.length > 0 && (
        <MeaningChoices
          title={
            isHebrew
              ? 'In the Septuagint, rendered as'
              : 'In the Septuagint, and the Hebrew it renders'
          }
          choices={septuagint}
          chosen={chosen}
          onToggle={(id) => {
            setMany([id], !chosen.has(id));
          }}
        />
      )}
      <p className={styles.meaningSummary} role="status">
        {formatInteger(others)} other {others === 1 ? 'verse' : 'verses'}
        {alsoLinked.size > 0 && (
          <>
            , {formatInteger(alsoLinked.size)} of them also{' '}
            {alsoLinked.size === 1 ? 'a cross-reference' : 'cross-references'}
          </>
        )}
        {onWordLayer && <span className={styles.onArcs}> · drawn in brass on the arcs</span>}
      </p>
      <WordVerses
        verses={verses}
        verse={verse}
        data={data}
        onSelect={onSelect}
        alsoLinked={alsoLinked}
      />
    </div>
  );
}

/** A row of words to add to (or take from) what is followed, each with its English. */
function MeaningChoices({
  title,
  choices,
  chosen,
  onToggle,
  onAll,
}: {
  readonly title: string;
  readonly choices: readonly MeaningChoice[];
  readonly chosen: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onAll?: (on: boolean) => void;
}) {
  const allOn = choices.every((choice) => chosen.has(choice.id));
  return (
    <div className={styles.choices}>
      <p className={styles.choicesTitle}>
        {title}
        {onAll && choices.length > 1 && (
          <button
            type="button"
            className={styles.choicesAll}
            onClick={() => {
              onAll(!allOn);
            }}
          >
            {allOn ? 'None' : 'All'}
          </button>
        )}
      </p>
      <div className={styles.chips}>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={styles.chip}
            aria-pressed={chosen.has(choice.id)}
            title={choice.definition}
            onClick={() => {
              onToggle(choice.id);
            }}
          >
            <span className={styles.chipWord}>
              <span lang={choice.language}>{choice.lemma}</span>
              <span className={styles.chipCount}>{formatInteger(choice.verses.length)}</span>
            </span>
            <span className={styles.chipGloss}>
              {choice.gloss}
              {choice.note !== '' && <> · {choice.note}</>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
