# The flows

What a reader comes here to do, and the test that proves each one still works. The point of the
list is that it is the complete set: if a flow is not here, nothing is watching it.

Run them with `npm run test:e2e` (once: `npx playwright install --with-deps chromium`).

## Reading

| Flow                                                    | Covered by        |
| ------------------------------------------------------- | ----------------- |
| The whole Bible is drawn, and says how much is shown    | `reading.spec.ts` |
| Find a verse by typing its reference                    | `reading.spec.ts` |
| Open a whole chapter and see its verses listed          | `reading.spec.ts` |
| A reference that is not one says so and changes nothing | `reading.spec.ts` |
| Step to the next verse and back                         | `reading.spec.ts` |
| Close the details and return to the whole picture       | `reading.spec.ts` |
| Switch between Arcs and Threads, keeping the passage    | `reading.spec.ts` |

## Cross-references — the reason the app exists

| Flow                                                     | Covered by                 |
| -------------------------------------------------------- | -------------------------- |
| A verse lists where it points and what points at it      | `cross-references.spec.ts` |
| Follow a cross-reference to where it leads               | `reading.spec.ts`          |
| Fold a section away, and find it still folded next visit | `cross-references.spec.ts` |
| The section heading stays put while its list scrolls     | `cross-references.spec.ts` |
| See the genre breakdown of a passage's links             | `cross-references.spec.ts` |
| Raise the vote threshold and see fewer, better links     | `cross-references.spec.ts` |
| Hide a genre from the legend, and bring it back          | `cross-references.spec.ts` |

## The Hebrew and Greek

| Flow                                                          | Covered by               |
| ------------------------------------------------------------- | ------------------------ |
| A Greek verse lists its words, how they sound, what they mean | `original-words.spec.ts` |
| A Hebrew verse says Hebrew, and marks the script for a reader | `original-words.spec.ts` |
| Open a word and see every other verse that uses it            | `original-words.spec.ts` |
| Follow one of those verses                                    | `original-words.spec.ts` |
| The word stays in view while its verses scroll past           | `original-words.spec.ts` |
| The credit stays even when the section is folded away         | `original-words.spec.ts` |

## Translations

| Flow                                                    | Covered by             |
| ------------------------------------------------------- | ---------------------- |
| Choose another translation and see the text change      | `translations.spec.ts` |
| The choice is remembered for the next visit             | `translations.spec.ts` |
| The footer credit follows the translation on screen     | `translations.spec.ts` |
| Copy a passage with its reference, translation and link | `translations.spec.ts` |

## Sharing

| Flow                                                | Covered by                 |
| --------------------------------------------------- | -------------------------- |
| A shared address opens exactly the passage it names | `reading.spec.ts`          |
| …in the translation it names                        | `translations.spec.ts`     |
| …with the filter it names                           | `cross-references.spec.ts` |
| Back returns to the passage before it               | `reading.spec.ts`          |

## Installing and reading offline

| Flow                                                            | Covered by        |
| --------------------------------------------------------------- | ----------------- |
| The app and its data are stored on the first visit              | `offline.spec.ts` |
| The app still works with the network gone                       | `offline.spec.ts` |
| A translation chosen while online is there offline too          | `offline.spec.ts` |
| **A new release replaces the old cache instead of being stuck** | `offline.spec.ts` |
| **A withdrawn worker clears everything, in one visit**          | `offline.spec.ts` |
| The install guide opens from the footer, and from `#install`    | `offline.spec.ts` |

The two in bold are the ones worth the most: a cache that cannot be replaced would hold every
installed reader on an old version, and no amount of deploying would reach them. The second is
the way out if it ever happened.

## The shape of the page

| Flow                                                                 | Covered by           |
| -------------------------------------------------------------------- | -------------------- |
| The footer is one line, and on screen, at 320–1920px (twelve widths) | `responsive.spec.ts` |
| …and still one line with a font a tenth wider than this machine's    | `responsive.spec.ts` |
| The details are a side column on a desktop                           | `responsive.spec.ts` |
| …and a sheet at the bottom on a phone, which opens to full height    | `responsive.spec.ts` |
| The header's controls stay reachable on a phone                      | `responsive.spec.ts` |
| Every page loads with nothing in the console                         | `responsive.spec.ts` |

The font test earns its place: the footer is set in whatever UI font the reader's system has, and
those differ in width by about a tenth between the narrowest and the widest. A layout measured on
one machine can wrap on another — which is exactly how a two-line footer at 320px reached CI once.
Walking the font up locally turns that into a failure here instead.

Layout is checked by measuring, not by comparing images: "the footer is 30px tall and its right
edge is inside the viewport" means the same thing on every machine, while a pixel baseline does
not. Pictures are a separate suite — below.

## The gallery

`npm run test:visual` photographs every major screen at a desktop size (1440×900) and on a phone
(Pixel 7), and writes them to `tests/e2e/visual.spec.ts-snapshots/`. Open that folder to see what
the app currently looks like; a change to one of those files in a diff is a change to the app.

| Screen                                       | File               |
| -------------------------------------------- | ------------------ |
| Arcs, as the app opens                       | `arcs-home`        |
| Arcs, with the genre legend unfolded (phone) | `arcs-genres`      |
| Threads, as the view opens                   | `threads-home`     |
| A verse and its cross-references             | `verse-panel`      |
| A whole chapter                              | `chapter-panel`    |
| The same verse in Threads                    | `threads-verse`    |
| The details panel on its own                 | `panel-only`       |
| …in another translation                      | `panel-kjv`        |
| A Greek verse and its words                  | `words-greek`      |
| A word opened to every verse that uses it    | `words-expanded`   |
| A Hebrew verse, right to left                | `words-hebrew`     |
| The filters menu                             | `menu-filters`     |
| The translations menu                        | `menu-translation` |
| A reference that is not one                  | `search-error`     |
| The install guide                            | `install-guide`    |
| The loading screen                           | `loading`          |
| The error screen                             | `load-error`       |
| The debug dashboard                          | `debug`            |

Each file is suffixed with the project and platform (`-visual-phone-linux.png`), so baselines made
on macOS and on Linux sit side by side rather than overwriting each other.

**This suite is not part of `npm run test:e2e` or of CI**, on purpose: a baseline belongs to the
machine that drew it, and a font update on a runner would turn the main gate red for no reason.
The first run on a new machine writes its own baselines and reports them as failures — that is
Playwright saying "nothing to compare against yet", not a problem with the app.

After a deliberate design change, re-photograph with `npm run test:visual:update` and look at the
new images before committing them. To make baselines that CI could share, draw them inside the
same container CI uses:

```sh
docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.57.0-jammy \
  npx playwright test --project=visual-desktop --project=visual-phone --update-snapshots
```

## Deliberately not here

- **How the arcs look.** The drawing is GPU work; the suite checks that the canvas appears and
  that the counts beside it are right, not which pixels were lit.
- **Browsers other than Chromium.** These test the app's behaviour, not the engines'.
- **The data itself.** Whether Genesis 1:1 points where OpenBible says is the pipeline's business
  and is covered by the importers' unit tests, against fixtures.
