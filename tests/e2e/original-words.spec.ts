import { expect, test } from '@playwright/test';
import { PANEL, openPassage } from './helpers.ts';

test.describe('the Hebrew and Greek behind a verse', () => {
  test('a Greek verse lists its words, with how they sound and what they mean', async ({
    page,
  }) => {
    await openPassage(page, 'Acts.5.14');
    const band = page.locator(PANEL).getByRole('button', { name: /^Words/ });
    await expect(band).toBeVisible();
    await expect(page.locator(PANEL).getByRole('button', { name: /plēthos/ })).toContainText(
      'multitude',
    );
  });

  test('a Hebrew verse says Hebrew, and marks the script', async ({ page }) => {
    await openPassage(page, 'Gen.1.1');
    await expect(page.locator(PANEL).getByRole('button', { name: /^Words/ })).toBeVisible();
    await expect(page.locator(`${PANEL} strong[lang="he"]`).first()).toBeVisible();
  });

  test('a word opens to every other verse that uses it', async ({ page }) => {
    await openPassage(page, 'Acts.5.14');
    await page
      .locator(PANEL)
      .getByRole('button', { name: /plēthos/ })
      .click();
    // The connection the cross-references do not make.
    await expect(page.locator(PANEL).getByRole('button', { name: /^Luke 5:6/ })).toBeVisible();
  });

  test('one of those verses can be followed', async ({ page }) => {
    await openPassage(page, 'Acts.5.14');
    await page
      .locator(PANEL)
      .getByRole('button', { name: /plēthos/ })
      .click();
    await page
      .locator(PANEL)
      .getByRole('button', { name: /^Luke 5:6/ })
      .click();
    await expect(page.locator(PANEL).getByRole('heading', { name: 'Luke 5:6' })).toBeVisible();
    await expect(page).toHaveURL(/ref=Luke\.5\.6/);
  });

  test('the word stays below its section while its verses scroll past', async ({ page }) => {
    await openPassage(page, 'Acts.5.14');
    const word = page.locator(PANEL).getByRole('button', { name: /plēthos/ });
    await word.click();
    await word.scrollIntoViewIfNeeded();
    const scroll = page.locator(`${PANEL} [class*="scroll"]`);

    // Both headings pin: the section's band, and the word whose verses are being read. They sit
    // flush, so a reader always sees which section this is and whose verses these are.
    await expect
      .poll(
        async () =>
          scroll.evaluate((element) => {
            element.scrollTop += 120;
            const top = element.getBoundingClientRect().top;
            const band = [...element.querySelectorAll('h3')].find(
              (heading) => Math.abs(heading.getBoundingClientRect().top - top) < 4,
            );
            const open = element.querySelector('button[aria-expanded="true"][class*="word"]');
            if (!band || !open) {
              return null;
            }
            const gap = open.getBoundingClientRect().top - band.getBoundingClientRect().bottom;
            return Math.abs(gap) < 1.5 ? 'flush' : `gap ${String(Math.round(gap))}`;
          }),
        { timeout: 30_000 },
      )
      .toBe('flush');
  });

  test('the credit stays even when the section is folded away', async ({ page }) => {
    await openPassage(page, 'Gen.1.1');
    const band = page.locator(PANEL).getByRole('button', { name: /^Words/ });
    await band.click();
    await expect(band).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(PANEL).getByRole('link', { name: 'STEP Bible' })).toBeVisible();
  });

  test('the words file is fetched only once a verse is opened', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/data/words/')) {
        requests.push(request.url());
      }
    });
    await page.goto('./');
    await page.locator('div[data-active="true"] footer').first().waitFor();
    await page.waitForTimeout(1500);
    expect(requests).toHaveLength(0);

    await openPassage(page, 'Gen.1.1');
    await expect(page.locator(PANEL).getByRole('button', { name: /^Words/ })).toBeVisible();
    expect(requests.length).toBeGreaterThan(0);
  });
});
