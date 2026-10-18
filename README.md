# Bible Cross-References: the sandbox

An open sandbox for exploring how the Bible is woven together, built on
[Oleksii Trekhleb's Bible Cross-References](https://github.com/trekhleb/bible-cross-references).

**Live:** [dkcoleman.com/bible](https://dkcoleman.com/bible) · **How it works:**
[the engine, step by step](https://dkcoleman.com/bible/how-it-works) · **The original:**
[trekhleb.dev/bible-cross-references](https://trekhleb.dev/bible-cross-references/)

## Credit first

All of this stands on Oleksii Trekhleb's work. He designed the Arcs and Threads views, the data
pipeline with its pinned sources, the plugin layout, the offline and install support, and the
test suite. His repository is MIT licensed, and this one keeps his license and his name on it. If
you want the clean, small, carefully tested version, use his:
[trekhleb/bible-cross-references](https://github.com/trekhleb/bible-cross-references). This
repository is a fork that tracks it and merges his updates, as it did on 2026-10-18.

This repository is the sandbox. It is where we try bigger ideas on top of his base. It is not a
replacement for his. Some of what is here is experimental, and some of it may not stay.

## What the sandbox adds

- **More translations.** BSB and KJV (his), plus ASV, WEB and MSB (all public domain). MSB stands
  in for the NKJV. The NASB works if you supply the file yourself (see
  [Licensed translations](#licensed-translations)).
- **A lexicon.** Tap a Hebrew or Greek word to see its meaning (Strong's, with Abbott-Smith senses
  for Greek and the Brown-Driver-Briggs outline for Hebrew), its word family (one root up, the
  words built on it down), and the verses that use it.
- **A Septuagint bridge.** The Greek Old Testament is lined up verse by verse with the Hebrew, and
  its words are paired with Hebrew words, so you can trace a Hebrew word to a Greek one and back,
  with the English for each. 22,164 of 23,240 Septuagint verses are aligned, and 5,838 word pairs
  are linked.
- **A word layer.** Open a word and its verses are drawn in brass over the arcs, and over the
  threads, from the verse you are reading.
- **Evidence beside the cross-references.** Three more ways two verses can be linked, kept apart
  from the cross-references: they share rare Hebrew or Greek words (169,421 pairs), a New Testament
  verse quotes the Septuagint (512 pairs), or an embedding model finds them close in meaning
  (57,317 pairs). A verse also shows which links agree. The **Agreement** filter keeps only the
  arcs that more than one kind of evidence supports (26,341 of 153,419).
- **A histogram under the arcs.** Bars show how often each verse is referenced, in either
  direction, in the genre colors. The idea comes from Chris Harrison's BibleViz.
- **A panel you arrange.** Drag the panel's sections into the order you like, or use the arrow
  keys. The order is kept in your browser.
- **A loading animation that finishes.** It runs for five seconds, builds a full arc diagram, and
  fades into the explorer.
- **A feedback form.** The footer sends a report as an issue in this repository, labeled `bug`,
  `feature` or `enhancement`. Without a server it opens GitHub's new-issue page, already filled in.

The same code runs the explorer at [dkcoleman.com/bible](https://dkcoleman.com/bible), inside a
Next.js site. This repository is the plain Vite version, in his layout.

## Why this exists

Readers of the Bible have followed cross-references for centuries: the small notes in the margin
that send you from one passage to another that echoes, quotes or fulfills it. On paper you follow
them one at a time, so the bigger picture stays hidden. This project draws all 344,799 of them at
once. You can start from a view of the whole Bible, zoom down to a single verse, and read it with
every connection one click away. The original project is free and open source, and so is this one.

## What you can do

### Arcs: the whole Bible at once

![Arcs: every verse of the Bible on one line, with its cross-references drawn as arcs](public/screenshots/arcs.jpg)

- All 31,102 verses sit on one line, from Genesis to Revelation, and every cross-reference is an
  arc colored by the genres it connects.
- Zoom from the whole Bible down to single verses; hover a passage to see how many connections it
  has.
- Search for any reference ("John 3:16", "Ps 23") or click a passage to see where its links land.
- Read it in the BSB, KJV, ASV, WEB or MSB (and the NASB, if you supply it); the choice is
  remembered and travels in the link you share
  ([`?t=kjv`](https://david-dovito.github.io/bible-cross-references/?ref=John.3.16&t=kjv)).

### Focus a passage

![Arcs with John 3:16 focused: its connections highlighted, and a panel with its text and references](public/screenshots/arcs-verse.jpg)

The details panel shows the passage's text, where its connections go by genre, and every reference
with its text. Each one is a link: follow it to travel there. "Read in context" opens the passage in
Threads.

A verse also lists the Hebrew or Greek words behind it — the dictionary form, how it is said and
what it means — and, under each one, every other verse that uses the same word, least common
first. It is a different kind of link from a cross-reference and is kept apart from it: a
cross-reference is somebody's judgement that two passages belong together, while this is the plain
fact that they share a word. Acts 5:14 and Luke 5:6, for instance, share πλῆθος (_plēthos_,
"multitude"), which no cross-reference joins. Words used in more than 1,000 verses are left out, and
the text of the verse in its original language is never shown: only the dictionary form.

### Threads: read with the connections in view

![Threads: Psalm 23 with threads from each verse to where its cross-references land](public/screenshots/threads.jpg)

- Read a chapter while each verse sends threads to where its cross-references land in the whole
  Bible, shown as a bar of all 66 books.
- Switch between what a verse points to, what points to it, or both.
- Tap a verse for its connections and follow them from passage to passage. "Show in Arcs" leads
  back to the big picture.

### On your phone

![Both views on a phone: Arcs with Psalm 23:1 focused, and Threads with John 1](public/screenshots/phone.jpg)

Both views work on phones. On the arcs, touch and hold, then slide, to preview passages (on the book
bar, just slide), and pinch to zoom. The details open in a sheet that you drag up to read and pull
down to close. Every passage has its own link, filters included, e.g.
[`?ref=John.3.16`](https://david-dovito.github.io/bible-cross-references/?ref=John.3.16), so you can share
exactly what you are looking at.

### Install it, and read with no connection

Every footer carries a quiet **Install** link — an arrow alone on phones — which opens the steps
for the device you are reading on. The same guide opens at
[`#install`](https://david-dovito.github.io/bible-cross-references/#install), so that address can be sent to
someone who asks for "the app". Inside the installed app the link is gone, since the browser tells
the page it is already running as one.

| Device          | How                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone and iPad | Safari's share button, then _Add to Home Screen_. Other iOS browsers offer the same item where they support it (iOS 16.4 and later). |
| Android         | Chrome's menu, then _Install app_.                                                                                                   |
| Chrome, Edge    | The install button at the end of the address bar.                                                                                    |
| Safari on a Mac | _Share → Add to Dock_.                                                                                                               |

Open it once while you are online. The service worker ([`sw/`](sw/)) then keeps the pages, this
version's code and the datasets on the device, so the whole Bible, its 344,799 cross-references and
the text you are reading all work with no connection, and open instantly on the next visit. On an
iPhone or iPad that first visit has to happen inside the installed app: a home-screen app there has
storage of its own, apart from Safari's. On Android and the desktop the two share it, so the visit
that installed the app has already done the work.

## Data

Everything here is openly available data. The original's sources are unchanged; the sandbox adds
the rows marked "sandbox".

| Dataset          | Source                                                                                                                                                              | License                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Bible text       | [Berean Standard Bible](https://berean.bible/) (BSB), the default                                                                                                   | Public domain                                                                           |
| Bible text       | [King James Version](https://ebible.org/Scriptures/details.php?id=eng-kjv2006) (KJV), from eBible.org                                                               | Public domain (see the note below)                                                      |
| Bible text       | Sandbox: [ASV](https://ebible.org/Scriptures/details.php?id=eng-asv), [WEB](https://worldenglish.bible/), [MSB](https://majoritybible.com/)                         | Public domain                                                                           |
| Cross-references | [OpenBible.info](https://www.openbible.info/labs/cross-references/), largely from the _Treasury of Scripture Knowledge_                                             | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                               |
| Original words   | [STEPBible](https://github.com/STEPBible/STEPBible-Data) (TAHOT, TAGNT and their lexicons), Tyndale House, Cambridge                                                | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                               |
| Word meanings    | Sandbox: [Strong's dictionaries](https://github.com/openscriptures/strongs) and the [BDB lexicon](https://github.com/openscriptures/HebrewLexicon), Open Scriptures | Public domain texts, CC BY-SA and CC BY 4.0 packaging, as listed in `data/sources.json` |
| Septuagint       | Sandbox: [Open Scriptures Septuagint Project](https://github.com/openscriptures/GreekResources) (the CATSS alignment)                                               | CC BY 4.0                                                                               |
| Evidence         | Sandbox: computed here from the data above, and from bge-small-en-v1.5 (BAAI, MIT) run over the BSB, offline, in `tools/similarity/`                                | Derived                                                                                 |

The notes in the original's README about the KJV in the United Kingdom, and about what the
cross-references mean (and how votes rank them), apply here unchanged. Read them in
[his Data section](https://github.com/trekhleb/bible-cross-references#data).

[`data/sources.json`](data/sources.json) pins every source by SHA-256. The small files are in
[`data/raw/`](data/raw/); the large ones are downloaded by the build and checked against their
pins, so a dataset is never built from a file nobody vouched for. If a publisher changes a file,
the build stops and tells you. `npm run dev` and `npm run build` turn the sources into datasets in
`public/data/` (generated, git-ignored).

### Licensed translations

The NASB is under copyright (The Lockman Foundation), so it is not in this repository and is never
downloaded. If you own a copy, put it at `data/private/nasb.txt`, one verse per line (book name,
chapter and verse, a tab, the text). The build then adds it. The folder and anything built from it
are git-ignored. When shown, the NASB carries Lockman's notice and "For personal use only."

### Refreshing the meaning model

The meaning pairs come from `tools/similarity/`, which runs offline (about 15 minutes) and writes
`data/derived/similar-bsb.json`, which is committed:

```sh
cd tools/similarity && npm install && npm run embed
```

To adopt a newer version of a source (OpenBible.info updates its vote counts from time to time):

```sh
npm run data:fetch -- --update   # download and re-pin the new version
npm run data:build               # rebuild, then review the numbers on /debug/
```

Then commit `data/raw/` and `data/sources.json`.

## Development

Requirements: [Node.js](https://nodejs.org/) 24 or newer (see `.nvmrc`).

```sh
npm install
npm run dev
```

Then open <http://localhost:5173/> for the app, or <http://localhost:5173/debug/> for an internal
page that shows the datasets behind it.

The first `npm run dev` downloads the pinned source files that are not in the repository (about
100 MB, mostly STEPBible). To add the NASB, see [Licensed translations](#licensed-translations).

| Script                  | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Build the datasets and start the Vite dev server                |
| `npm run build`         | Build the datasets, type-check, and build the site into `dist/` |
| `npm run preview`       | Serve the built site locally, at its deployed path (see below)  |
| `npm run data`          | Verify the raw files, or fetch missing ones, and build datasets |
| `npm run check`         | The gate: type check, lint, format check, unit tests + coverage |
| `npm run test`          | Run the unit tests                                              |
| `npm run test:watch`    | Run the unit tests in watch mode                                |
| `npm run test:coverage` | Run the unit tests and check the coverage thresholds            |
| `npm run test:e2e`      | Run the end-to-end tests against the built site                 |
| `npm run format`        | Format all files with Prettier                                  |

### Project structure

```text
data/                    Source data (raw/), its pins (sources.json), and derived/ (the meaning model's output)
tools/similarity/        Offline: embeds every verse and writes each verse's nearest neighbors (not part of the build)
scripts/data/            Data pipeline: fetch and build CLIs, one importer per source
index.html, threads/     Page entries of the app (the same app, one per view)
debug/                   Page entry of the internal data page
vite/                    Build plugins: page metadata, first frame, offline cache, analytics
sw/                      The service worker that caches the site for offline use
public/                  Icons, the social preview image and README screenshots
src/core/                Framework-free domain code shared by the app and the pipeline
  bible/                 Books, genres, versification, verse references, passages
  datasets/              Dataset IDs, file formats and their runtime validation
src/translations/        Translation plugins: manifests, registry, loading, text search
src/words/               Original-language words, the lexicon (meanings, roots) and the Septuagint bridge
src/links/               The evidence layer: shared words, quotations, meaning
src/cross-references/    Cross-reference plugins: manifests, registry, bidirectional index
src/app/                 The app: its views, the URL state and the view switch
src/visualizations/      One folder per visualization (Arcs, Threads), plus shared blocks
src/features/debug/      The /debug/ page
src/shared/              Reusable UI (footer, icons, tables), styles, formatting and loading
tests/                   Repository-level tests, and tests/e2e/ the end-to-end suite
```

Visualizations never import each other; `src/app/views.ts` lists them, and the app connects them.

### Tests

Two suites, and a pull request has to pass both.

```sh
npm run check      # types, lint, formatting, unit tests, coverage thresholds
npm run test:e2e   # the flows, in a real browser against the built site
```

**Unit tests** (`*.test.ts` beside the code, Vitest with happy-dom) cover the domain code, the
data pipeline, the build plugins and the components. They are the gate on coverage: `npm run
check` fails below **85% of statements and lines, 84% of functions** (`test.coverage.thresholds` in
`vite.config.ts`). Branches are held at 70%. (The original held 98 and 88; the sandbox's engine is newer than its tests, and the floor rises as they arrive.) Branches are held lower because, because `noUncheckedIndexedAccess` makes
TypeScript demand a fallback on every array read and most of those cannot happen.

Three kinds of file are left out of that measurement, each for a reason, and all three are
covered by the end-to-end suite instead:

- **Entry points** (`src/app/main.tsx`, `scripts/data/build.ts`, …), which run on import, so
  importing them is running them.
- **GPU drawing** (shaders, the WebGL scenes, the canvas painters): a fake DOM cannot give them a
  context, and a mock of one would only test the mock.
- **Touch choreography and the views that host a canvas** (`use-bottom-sheet.ts`,
  `ArcsExplorer.tsx`, …): a fake DOM can be made to report any pointer path and any transform.

**End-to-end tests** (`tests/e2e/`, Playwright against `npm run preview`) cover what only a real
browser can answer: that a reader can read a chapter, open a verse, follow a cross-reference, see
the Hebrew and Greek, filter and switch translation; that the layout holds from 320px to 1920px;
and that the offline cache stores the app, serves it with the network gone, and — the one failure
that could strand an audience on a stale version — **replaces itself when a new release ships**.
They run in three projects: `desktop`, `phone` (Pixel 7), and `offline`, which runs last on its
own because it rewrites the built worker to stand in for a new release.

**The gallery** (`npm run test:visual`) photographs every major screen at desktop and phone size
into `tests/e2e/visual.spec.ts-snapshots/` — open that folder to see what the app looks like. It
is deliberately outside CI and outside `npm run test:e2e`, because a pixel baseline belongs to the
machine that drew it; `tests/e2e/README.md` explains how to regenerate them.

To run any of them locally you need the browser once: `npx playwright install --with-deps chromium`.

### Deployment

The site is static. The CI workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
publishes every push to `main` with GitHub Pages, once all checks pass, at
[david-dovito.github.io/bible-cross-references](https://david-dovito.github.io/bible-cross-references/), so production
builds use the base path `/bible-cross-references/`, and `npm run preview` serves the build at
<http://localhost:4173/bible-cross-references/>. Besides the pages, the build writes:

- the page metadata: canonical URLs, Open Graph and Twitter cards, and structured data;
- `sitemap.xml`;
- a web app manifest and a service worker (from [`sw/`](sw/)). The worker is scoped to the site's
  path, so it never touches the rest of the domain.

Each release caches under a name of its own, a hash of the files it was built from. A new worker
installs beside the running one, takes over, and deletes the previous release's cache; pages are
fetched from the network first, so an online reader always has the newest one. Every visit asks
for the newest worker ([`src/app/register-offline-cache.ts`](src/app/register-offline-cache.ts))
rather than leaving that to the browser's own check, which it may put off for a day.

If the offline cache ever has to be withdrawn, replace the body of
[`sw/service-worker.ts`](sw/service-worker.ts) with a worker that removes itself, keeping the
`declare const self` line at the top, and deploy that:

```ts
self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('bible-cross-references')) {
          await caches.delete(name);
        }
      }
      await self.registration.unregister();
    })(),
  );
});
```

One visit then unregisters the worker and deletes every cache it made, and the site goes on as an
ordinary one. Taking `sw.js` off the server does not do this: the registration survives a 404.

The analytics tag in this repository belongs to the original and only reports from its own domain,
so this build and any build deployed elsewhere send nothing. To build for another location, set the path and
the origin:

```sh
BASE_PATH=/ SITE_ORIGIN=https://example.org npm run build
```

## License and credits

The code is released under the [MIT License](LICENSE). The license keeps the original's copyright
line, as MIT asks: Copyright (c) 2026 Oleksii Trekhleb. The data keeps its own licenses (see
[Data](#data)):

> Cross-reference data: OpenBible.info (CC BY 4.0), largely from the public-domain Treasury of
> Scripture Knowledge. Modified: re-indexed to KJV verse numbering.
> Scripture text: Berean Standard Bible (BSB), dedicated to the public domain.
> Scripture text: King James Version (Authorized Version), the 1769 text, public domain in the
> United States and most of the world; in the United Kingdom rights are vested in the Crown and
> administered by the Crown's patentee, Cambridge University Press.
> Scripture text: American Standard Version, World English Bible and Majority Standard Bible,
> public domain.
> Original-language words: STEP Bible (CC BY 4.0), based on work at Tyndale House, Cambridge.
> Modified: reduced to the dictionary forms used in each verse, keyed to KJV verse numbering,
> with psalm superscriptions left out.
> Word meanings: Strong's dictionaries and the Brown-Driver-Briggs lexicon, Open Scriptures
> (CC BY-SA and CC BY 4.0 as listed in `data/sources.json`); Abbott-Smith's Greek lexicon.
> Septuagint: Open Scriptures Septuagint Project (CC BY 4.0), after the CATSS database.

**Credits.** The original project, its design, its pipeline, its tests and its offline support:
[Oleksii Trekhleb](https://trekhleb.dev). The sandbox: [David Coleman](https://dkcoleman.com).
UI icons are from [Lucide](https://lucide.dev/) (ISC License), plus the touch-gesture icons from
[Material Design Icons](https://fonts.google.com/icons) (Apache License 2.0), via
[react-icons](https://react-icons.github.io/react-icons/) (MIT). Arcs is inspired by Chris Harrison
and Christoph Römhild's
[Bible Cross-References](https://www.chrisharrison.net/index.php/Visualizations/BibleViz), the
histogram under it by the same work, and the genre colors by Drawing with Data's
[Bible Fascinator](https://designs.drawingwithdata.com/fascinator).
