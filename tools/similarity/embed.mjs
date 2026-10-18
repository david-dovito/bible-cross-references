/**
 * Meaning similarity, the explorer's one model-made layer (docs/BIBLE.md, "Evidence").
 *
 *   cd bible/tools/similarity && npm ci && npm run embed
 *
 * Embeds every verse of the Berean Standard Bible with BAAI's bge-small-en-v1.5 (MIT), then finds
 * each verse's nearest neighbours by cosine similarity, leaving out its own neighbourhood (the
 * verses close by in the same book say the same thing for being close, not for meaning it). Writes
 * `bible/data/derived/similar-bsb.json`, which is committed: the build reads it and never runs
 * the model, so a deploy costs nothing more. Run it again only when the BSB or the model changes.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pipeline } from '@huggingface/transformers';

const ROOT = resolve(import.meta.dirname, '../../..');
const TEXT = resolve(ROOT, 'public/bible/data/translations/bsb.json');
const OUT = resolve(ROOT, 'bible/data/derived/similar-bsb.json');
const MODEL = 'Xenova/bge-small-en-v1.5';
const NEIGHBOURS = 12;
/** Verses this close in the same book are not counted as neighbours. */
const NEIGHBOURHOOD = 5;
const BATCH = 64;

const raw = await readFile(TEXT);
const { verses: texts } = JSON.parse(raw.toString('utf8'));
const count = texts.length;
const bookStarts = JSON.parse(
  await readFile(resolve(import.meta.dirname, 'book-starts.json'), 'utf8'),
);

/**
 * The BSB keeps a psalm's title inside its first verse ("A Psalm of David. The LORD is my
 * shepherd"), which made every titled first verse the others' nearest neighbour. Titles are
 * stripped before embedding: up to five leading sentences that begin the way the titles do.
 */
const PSALMS = 18;
const TITLE =
  /^[”’"]?\s*(?:(?:For the choirmaster|For the director|A Psalm|A Song|A song|A Maskil|A Miktam|A Prayer|A prayer|A Shiggaion|A Michtam|Of David|Of Solomon|Of Asaph|According to|To the tune|For remembrance|For the dedication|For the Sabbath|A psalm|With stringed instruments|With flutes|On an eight|On the|Set to|Concerning|Of the sons of Korah|For the sons of Korah|Of Moses|Of Heman|Of Ethan|Of Jeduthun|For Jeduthun|A Davidic|A teaching|For teaching|A contemplative|A Psalm of)[^.]*\.\s*)/;
const psalmsStart = bookStarts[PSALMS];
const psalmsEnd = bookStarts[PSALMS + 1];
const verses = texts.map((text, verse) => {
  if (verse < psalmsStart || verse >= psalmsEnd) return text;
  let stripped = text;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = stripped.replace(TITLE, '');
    if (next === stripped || next.length < 12) break;
    stripped = next;
  }
  return stripped;
});
console.log(`stripped psalm titles: "${texts[psalmsStart + 0]}" → "${verses[psalmsStart + 0]}"`);
console.log(`${count} verses; loading ${MODEL}…`);
const embed = await pipeline('feature-extraction', MODEL, { dtype: 'fp32' });

const dims = 384;
const vectors = new Float32Array(count * dims);
const started = Date.now();
for (let start = 0; start < count; start += BATCH) {
  const batch = verses.slice(start, start + BATCH).map((text) => (text === '' ? ' ' : text));
  const output = await embed(batch, { pooling: 'cls', normalize: true });
  vectors.set(output.data, start * dims);
  if ((start / BATCH) % 50 === 0) {
    const done = start + batch.length;
    console.log(`embedded ${done}/${count} (${Math.round((Date.now() - started) / 1000)} s)`);
  }
}

// Which book each verse is in, from the canonical book starts.
const bookOf = new Int32Array(count);
bookStarts.forEach((startIndex, book) => {
  for (let v = startIndex; v < (bookStarts[book + 1] ?? count); v += 1) bookOf[v] = book;
});

const neighbours = new Int32Array(count * NEIGHBOURS).fill(-1);
const scores = new Float32Array(count * NEIGHBOURS);
const empty = verses.map((text) => text === '');
for (let a = 0; a < count; a += 1) {
  const best = new Float32Array(NEIGHBOURS).fill(-2);
  const bestAt = new Int32Array(NEIGHBOURS).fill(-1);
  if (!empty[a]) {
    const base = a * dims;
    for (let b = 0; b < count; b += 1) {
      if (empty[b] || (bookOf[a] === bookOf[b] && Math.abs(a - b) <= NEIGHBOURHOOD)) continue;
      let dot = 0;
      const other = b * dims;
      for (let d = 0; d < dims; d += 1) dot += vectors[base + d] * vectors[other + d];
      if (dot > best[NEIGHBOURS - 1]) {
        let at = NEIGHBOURS - 1;
        while (at > 0 && best[at - 1] < dot) {
          best[at] = best[at - 1];
          bestAt[at] = bestAt[at - 1];
          at -= 1;
        }
        best[at] = dot;
        bestAt[at] = b;
      }
    }
  }
  neighbours.set(bestAt, a * NEIGHBOURS);
  scores.set(best, a * NEIGHBOURS);
  if (a % 2000 === 0)
    console.log(`neighbours ${a}/${count} (${Math.round((Date.now() - started) / 1000)} s)`);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    model: MODEL,
    text: 'bsb',
    psalmTitles: 'stripped',
    textSha256: createHash('sha256').update(raw).digest('hex'),
    neighbours: NEIGHBOURS,
    neighbourhood: NEIGHBOURHOOD,
    verses: Array.from(neighbours),
    scores: Array.from(scores, (score) => Math.round(Math.max(score, 0) * 1000)),
  }),
);
console.log(`wrote ${OUT} in ${Math.round((Date.now() - started) / 1000)} s`);
