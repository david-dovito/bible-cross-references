import { expect, test, type Page } from '@playwright/test';
import { ACTIVE, PANEL, openPanel, settle, waitForApp } from './helpers.ts';

/**
 * A picture of every major screen, at a desktop size and on a phone.
 *
 * These are here to be looked at as much as to be compared: the files under
 * `visual.spec.ts-snapshots/` are what the app actually looks like, and reviewing a change to one
 * of them is reviewing the change to the app. See tests/e2e/README.md for how to regenerate them.
 */

/** Phones get the whole page; a desktop window is already the whole page. */
const FULL = { fullPage: false } as const;

/** Opens the app at a passage, with everything settled and the sheet up on a phone. */
async function show(page: Page, path = './'): Promise<void> {
  await page.goto(path);
  await waitForApp(page);
  await settle(page);
}

test.describe('the whole Bible', () => {
  test('arcs, as the app opens', async ({ page }) => {
    await show(page);
    await expect(page).toHaveScreenshot('arcs-home.png', FULL);
  });

  test('arcs, with the genre legend unfolded', async ({ page }) => {
    // Only a phone folds the legend away; on a desktop it is already open in the shot above.
    test.skip(test.info().project.name !== 'visual-phone', 'The legend is always open here.');
    await show(page);
    await page.locator(ACTIVE).getByRole('button', { name: 'Show genres' }).click();
    await settle(page);
    await expect(page).toHaveScreenshot('arcs-genres.png', FULL);
  });

  test('threads, as the view opens', async ({ page }) => {
    await show(page, './threads/');
    await expect(page).toHaveScreenshot('threads-home.png', FULL);
  });
});

test.describe('a passage', () => {
  test('a verse and its cross-references', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('verse-panel.png', FULL);
  });

  test('a whole chapter', async ({ page }) => {
    await show(page, './?ref=Ps.23');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('chapter-panel.png', FULL);
  });

  test('the same verse in Threads', async ({ page }) => {
    await show(page, './threads/?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await expect(page).toHaveScreenshot('threads-verse.png', FULL);
  });

  test('the details panel on its own', async ({ page }) => {
    await show(page, './?ref=John.3.16');
    await openPanel(page);
    await settle(page);
    await expect(page.locator(PANEL)).toHaveScreenshot('panel-only.png');
  });
});

test.describe('the Hebrew and Greek', () => {
  test('a Greek verse, with its words listed', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /^Words/ })
      .waitFor();
    await settle(page);
    await expect(page.locator(PANEL)).toHaveScreenshot('words-greek.png');
  });

  test('a word opened to every verse that uses it', async ({ page }) => {
    await show(page, './?ref=Acts.5.14');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /plēthos/ })
      .click();
    await settle(page);
    await expect(page.locator(PANEL)).toHaveScreenshot('words-expanded.png');
  });

  test('a Hebrew verse, right to left', async ({ page }) => {
    await show(page, './?ref=Gen.1.1');
    await openPanel(page);
    await page
      .locator(PANEL)
      .getByRole('button', { name: /^Words/ })
      .waitFor();
    await settle(page);
    await expect(page.locator(PANEL)).toHaveScreenshot('words-hebrew.png');
  });
});

test.describe('the controls', () => {
  test('the filters', async ({ page }) => {
    await show(page);
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Filters/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-filters.png', FULL);
  });

  test('the translations', async ({ page }) => {
    await show(page);
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Translation/ })
      .click();
    await settle(page);
    await expect(page).toHaveScreenshot('menu-translation.png', FULL);
  });

  test('a reference that is not one', async ({ page }) => {
    await show(page);
    await page.locator(ACTIVE).getByRole('searchbox').fill('Hesitations 4:4');
    await page.locator(ACTIVE).getByRole('searchbox').press('Enter');
    await settle(page);
    await expect(page).toHaveScreenshot('search-error.png', FULL);
  });

  test('the app in another translation', async ({ page }) => {
    await show(page, './?ref=John.3.16&t=kjv');
    await openPanel(page);
    await settle(page);
    await expect(page.locator(PANEL)).toHaveScreenshot('panel-kjv.png');
  });
});

test.describe('installing', () => {
  test('the install guide', async ({ page }) => {
    await show(page, './#install');
    await page.locator('dialog[open]').waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('install-guide.png', FULL);
  });
});

test.describe('the loading and error screens', () => {
  test('the loading screen, before the data arrives', async ({ page }) => {
    // Hold the links back so the screen that waits for them stays on display.
    await page.route('**/cross-references/*.json', async () => {
      await new Promise(() => undefined);
    });
    await page.goto('./');
    await page.getByText(/Loading 31,102 verses/).waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('loading.png', FULL);
  });

  test('the error screen, when the data cannot be fetched', async ({ page }) => {
    await page.route('**/cross-references/*.json', (route) => route.abort());
    await page.goto('./');
    await page.getByRole('alert').waitFor();
    await settle(page);
    await expect(page).toHaveScreenshot('load-error.png', FULL);
  });
});

test.describe('the data page', () => {
  test('the debug dashboard', async ({ page }) => {
    await page.goto('./debug/');
    await page.locator('table').first().waitFor({ timeout: 45_000 });
    await settle(page);
    await expect(page).toHaveScreenshot('debug.png', FULL);
  });
});
