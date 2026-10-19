import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { ACTIVE, PANEL, waitForApp } from './helpers.ts';

const WORKER = resolve(import.meta.dirname, '../../dist/sw.js');

/**
 * These rewrite the built worker to act out a release, so they run one at a time and only in one
 * project; the file is always put back.
 */
test.describe.configure({ mode: 'serial' });

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'offline',
    'Only the offline project may write dist/sw.js.',
  );
});

/** Everything the worker has stored, by cache name. */
async function cacheState(page: Page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const out: Record<string, number> = {};
    for (const name of names) {
      out[name] = (await (await caches.open(name)).keys()).length;
    }
    const registration = await navigator.serviceWorker.getRegistration();
    return { caches: out, registered: Boolean(registration?.active) };
  });
}

async function installWorker(page: Page): Promise<void> {
  await page.goto('./?ref=John.3.16');
  await waitForApp(page);
  await expect
    .poll(async () => (await cacheState(page)).registered, { timeout: 30_000 })
    .toBe(true);
  await expect
    .poll(async () => Object.keys((await cacheState(page)).caches).length, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(2);
}

test.describe('the offline cache', () => {
  test('stores the app and its data on the first visit', async ({ page }) => {
    await installWorker(page);
    const { caches: stored } = await cacheState(page);
    const shell = Object.keys(stored).find((name) => name.includes('-shell-'));
    expect(shell).toBeTruthy();
    expect(stored[shell ?? '']).toBeGreaterThan(10);
    expect(stored['bible-cross-references-data']).toBeGreaterThanOrEqual(2);
  });

  test('the app still works with the network gone', async ({ page, context }) => {
    await installWorker(page);
    await context.setOffline(true);
    await page.reload();
    await waitForApp(page);
    await expect(page.locator(PANEL).getByRole('heading', { name: 'John 3:16' })).toBeVisible();
    await expect(page.locator(PANEL)).toContainText(/For God so loved the world/);
    await context.setOffline(false);
  });

  test('a translation chosen while online is there offline too', async ({ page, context }) => {
    await installWorker(page);
    await page
      .locator(ACTIVE)
      .getByRole('button', { name: /Translation/ })
      .click();
    await page
      .locator(ACTIVE)
      .getByRole('radio', { name: /King James/ })
      .check();
    await expect(page.locator(PANEL)).toContainText(/only begotten Son/);
    await expect
      .poll(async () => (await cacheState(page)).caches['bible-cross-references-data'] ?? 0, {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);

    await context.setOffline(true);
    await page.reload();
    await waitForApp(page);
    await expect(page.locator(PANEL)).toContainText(/only begotten Son/);
    await context.setOffline(false);
  });

  test('a new release replaces the old cache instead of being stuck behind it', async ({
    page,
  }) => {
    await installWorker(page);
    const before = Object.keys((await cacheState(page)).caches).find((name) =>
      name.includes('-shell-'),
    );
    expect(before).toBeTruthy();

    const original = await readFile(WORKER, 'utf8');
    try {
      // What a deploy looks like to a browser: the same URL, different bytes.
      await writeFile(
        WORKER,
        original.replace(/const VERSION = "(\w+)"/, 'const VERSION = "next"'),
      );
      await page.reload();
      await waitForApp(page);

      await expect
        .poll(
          async () =>
            Object.keys((await cacheState(page)).caches).find((name) => name.includes('-shell-')),
          { timeout: 30_000 },
        )
        .toBe('bible-cross-references-shell-next');
      // The old one is gone, not left to grow forever.
      const { caches: after } = await cacheState(page);
      expect(Object.keys(after)).not.toContain(before);
    } finally {
      await writeFile(WORKER, original);
    }
  });

  test('a worker that withdraws itself clears everything, in one visit', async ({ page }) => {
    await installWorker(page);
    const original = await readFile(WORKER, 'utf8');
    try {
      // The escape hatch documented in README.md: deploy this and the cache is gone.
      await writeFile(
        WORKER,
        `self.addEventListener('install', () => self.skipWaiting());
         self.addEventListener('activate', (event) => {
           event.waitUntil((async () => {
             for (const name of await caches.keys()) {
               if (name.startsWith('bible-cross-references')) await caches.delete(name);
             }
             await self.registration.unregister();
           })());
         });`,
      );
      await page.reload();
      await waitForApp(page);

      await expect
        .poll(async () => Object.keys((await cacheState(page)).caches).length, { timeout: 30_000 })
        .toBe(0);
      // And the site still works, as an ordinary one.
      await expect(page.locator(`${ACTIVE} canvas`).first()).toBeVisible();
    } finally {
      await writeFile(WORKER, original);
      await page.goto('./');
      await page.evaluate(async () => {
        for (const registration of await navigator.serviceWorker.getRegistrations()) {
          await registration.unregister();
        }
        for (const name of await caches.keys()) {
          await caches.delete(name);
        }
      });
    }
  });
});

test.describe('the install guide', () => {
  test('opens from the footer and shows the steps for a device', async ({ page }) => {
    await page.goto('./');
    await waitForApp(page);
    await page.locator(`${ACTIVE} footer`).getByRole('button', { name: 'Install the app' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'iPhone', exact: true }).click();
    await expect(dialog).toContainText(/Add to Home Screen/);
    await dialog.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(dialog).toContainText(/address bar/);
  });

  test('opens straight from #install, and gives the address back when closed', async ({ page }) => {
    await page.goto('./?ref=John.3.16#install');
    await waitForApp(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page).toHaveURL(/\?ref=John\.3\.16$/);
  });
});
