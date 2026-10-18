import { describe, expect, it } from 'vitest';
import { importLexicon, type LexiconSources } from './lexicon.ts';

const OPTIONS = {
  license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  attribution: 'Lexicon.',
  provenance: {
    url: 'https://example.org/strongs.js',
    sha256: 'a'.repeat(64),
    retrievedAt: '2026-10-17',
  },
};

/** Open Scriptures' shape: a comment, then `var name = {…}; module.exports = name;`. */
const script = (name: string, entries: Record<string, object>) =>
  `/** header */\nvar ${name} = ${JSON.stringify(entries)};\nmodule.exports = ${name};\n`;

const row = (columns: readonly string[]) => columns.join('\t');

const SOURCES: LexiconSources = {
  strongsGreek: script('strongsGreekDictionary', {
    G5056: {
      lemma: 'τέλος',
      strongs_def: ' the point aimed at as a limit',
      derivation: 'from a primary τέλλω;',
      kjv_def: 'end',
    },
    G5046: {
      lemma: 'τέλειος',
      strongs_def: ' complete',
      derivation: 'from G5056 (τέλος);',
      kjv_def: 'perfect',
    },
    G5048: {
      lemma: 'τελειόω',
      strongs_def: ' to complete',
      derivation: 'from G5046 (τέλειος);',
      kjv_def: 'finish',
    },
    G1537: {
      lemma: 'ἐκ',
      strongs_def: ' out of',
      derivation: 'a primary preposition',
      kjv_def: 'of',
    },
  }),
  strongsHebrew: script('strongsHebrewDictionary', {
    H8549: {
      lemma: 'תָּמִים',
      strongs_def: 'entire',
      derivation: 'from H8552 (תָּמַם);',
      kjv_def: 'perfect',
    },
    H8552: {
      lemma: 'תָּמַם',
      strongs_def: 'to complete',
      derivation: 'a primitive root;',
      kjv_def: 'finish',
    },
    H3147: {
      lemma: 'יוֹתָם',
      strongs_def: 'Jotham',
      derivation: 'from H3068 and H8535;',
      kjv_def: 'Jotham',
    },
    H8535: {
      lemma: 'תָּם',
      strongs_def: 'complete',
      derivation: 'from H8552 (תָּמַם);',
      kjv_def: 'perfect',
    },
  }),
  greekLexicon: [
    row([
      'G5046',
      'G5046 =',
      'G5046',
      'τέλειος',
      'teleios',
      'G:A',
      'perfect',
      ' <b>τέλειος</b> [in LXX chiefly for תָּמִים ;] <b>having reached its end, mature</b>; <b>full-grown</b>',
    ]),
    row(['G5056', 'G5056 =', 'G5056', 'τέλος', 'telos', 'G:N-N', 'end', '']),
  ].join('\n'),
  hebrewLexicon: [
    row(['H8549', 'H8549 =', 'H8549', 'תָּמִים', 'ta.mim', 'H:A', 'unblemished', '']),
    row(['H8552', 'H8552 =', 'H8552', 'תָּמַם', 'ta.mam', 'H:V', 'to finish', '']),
    row(['H8535', 'H8535 =', 'H8535', 'תָּם', 'tam', 'H:A', 'complete', '']),
    row(['H3147', 'H3147G =', 'H3147G', 'יוֹתָם', 'yo.tam', 'N:N-M-P', 'Jotham', '']),
  ].join('\n'),
  bdb: [
    '<entry id="w.az.ae"><w>תָּמִים</w> <pos>adj</pos>. <def>complete</def>',
    '<sense n="1"><def>complete</def>, <def>whole</def></sense>',
    '<sense n="2"><def>sound</def>, <def>innocent</def></sense><status p="1071">base</status></entry>',
  ].join('\n'),
  bdbIndex: '<entry id="nts"><xref bdb="w.az.ae" strong="8549" twot="2522d"/></entry>',
  kjvBooks: [
    '\\v 1 Be thou \\w perfect|strong="H8549"\\w*. \\w Perfect|strong="H8549"\\w* \\w without blemish|strong="H8549"\\w*',
    '\\v 48 Be ye therefore \\w perfect|strong="G5046"\\w*',
  ],
};

describe('importLexicon', () => {
  const { entries } = importLexicon(SOURCES, OPTIONS);
  const at = (strongs: string) => entries.strongs.indexOf(strongs);
  const listed = (offsets: readonly number[], values: readonly number[], strongs: string) =>
    values.slice(offsets[at(strongs)], offsets[at(strongs) + 1]).map((i) => entries.strongs[i]);

  it("keys every word by its plain Strong's number, with Strong's definition", () => {
    expect(entries.definition[at('G5046')]).toBe('complete');
    expect(entries.lemma[at('H8549')]).toBe('תָּמִים');
  });

  it('gives Greek Abbott-Smith senses and Hebrew a BDB outline', () => {
    expect(entries.senses[at('G5046')]).toBe('having reached its end, mature; full-grown');
    expect(entries.senses[at('H8549')]).toBe('1. complete, whole · 2. sound, innocent');
  });

  it('counts how the KJV translates a word, a sentence-initial capital merged', () => {
    expect(entries.translations[at('H8549')]).toBe('perfect (2), without blemish (1)');
    expect(entries.occurrences[at('H8549')]).toBe(3);
  });

  it('builds families from derivations: the root, and what is built on it', () => {
    expect(listed(entries.familyOffsets, entries.family, 'G5046')).toEqual(['G5056', 'G5048']);
    // Jotham shares the root but is a name, and names stay out of other words' families.
    expect(listed(entries.familyOffsets, entries.family, 'H8549')).toEqual(['H8552', 'H8535']);
  });

  it("finds the Hebrew of Abbott-Smith's Septuagint note", () => {
    expect(listed(entries.equivalentOffsets, entries.equivalents, 'G5046')).toEqual(['H8549']);
  });
});
