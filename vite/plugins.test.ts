import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { analytics } from './analytics.ts';
import { firstFrame } from './first-frame.ts';
import { offline } from './offline.ts';
import { PAGES } from './site.ts';
import { siteHead } from './site-head.ts';

const APP_PAGE = Object.values(PAGES).find((page) => page.app);
const PAGE_PATH = `/${APP_PAGE?.entry ?? 'index.html'}`;

/** What these plugins hand back: the page rewritten, tags to add, or both. */
type IndexHtmlResult = string | { html: string; tags: unknown[] };
type IndexHtmlHandler = (html: string, context: { path: string }) => IndexHtmlResult;

/** Calls a plugin hook that may be a function or an object with a handler. */
function hook(plugin: Plugin, name: 'transformIndexHtml'): IndexHtmlHandler {
  const value = plugin[name];
  return (typeof value === 'function' ? value : value?.handler) as IndexHtmlHandler;
}

function resolveConfig(plugin: Plugin, command: 'build' | 'serve', base = '/'): void {
  const configResolved = plugin.configResolved;
  const handler = typeof configResolved === 'function' ? configResolved : configResolved?.handler;
  void handler?.call({} as never, { command, base } as never);
}

const HTML = '<html><head><title>t</title></head><body><div id="root"></div></body></html>';

describe('analytics', () => {
  it('adds the tag to a built page', () => {
    const plugin = analytics();
    resolveConfig(plugin, 'build');
    const tags = hook(plugin, 'transformIndexHtml')(HTML, { path: PAGE_PATH });
    expect(JSON.stringify(tags)).toContain('googletagmanager.com');
  });

  it("reports only from the site's own origin, so forks and previews send nothing", () => {
    const plugin = analytics();
    resolveConfig(plugin, 'build');
    const tags = hook(plugin, 'transformIndexHtml')(HTML, { path: PAGE_PATH });
    expect(JSON.stringify(tags)).toContain('trekhleb.dev');
  });

  it('adds nothing on the dev server', () => {
    const plugin = analytics();
    resolveConfig(plugin, 'serve');
    expect(
      hook(plugin, 'transformIndexHtml')(HTML, {
        path: PAGE_PATH,
      }),
    ).toEqual([]);
  });

  it('adds nothing to a file that is not a page', () => {
    const plugin = analytics();
    resolveConfig(plugin, 'build');
    expect(hook(plugin, 'transformIndexHtml')(HTML, { path: '/elsewhere.html' })).toEqual([]);
  });
});

describe('firstFrame', () => {
  const transform = () => hook(firstFrame(), 'transformIndexHtml');

  it('fills the empty root with the logo, so the first paint is not blank', () => {
    const result = transform()(HTML, { path: PAGE_PATH });
    expect(typeof result).not.toBe('string');
    if (typeof result === 'string') return;
    expect(result.html).toContain('first-frame');
    expect(result.html).toContain('<svg');
    expect(JSON.stringify(result.tags)).toContain('color-scheme');
  });

  it('moves stylesheets to the end of the body, so content paints before them', () => {
    const withCss = HTML.replace('</head>', '<link rel="stylesheet" href="/a.css"></head>');
    const result = transform()(withCss, { path: PAGE_PATH });
    if (typeof result === 'string') throw new Error('expected a transform result');
    expect(result.html.indexOf('/a.css')).toBeGreaterThan(result.html.indexOf('<body>'));
  });

  it('leaves a page it does not know alone', () => {
    expect(transform()(HTML, { path: '/other.html' })).toBe(HTML);
  });

  it('refuses a page without the empty root it needs to fill', () => {
    expect(() => transform()('<html><body></body></html>', { path: PAGE_PATH })).toThrow(
      /expected an empty/,
    );
  });
});

describe('siteHead', () => {
  it('adds the metadata a shared link needs', () => {
    const plugin = siteHead();
    resolveConfig(plugin, 'build', '/bible-cross-references/');
    const tags = JSON.stringify(
      hook(plugin, 'transformIndexHtml')(HTML, {
        path: PAGE_PATH,
      }),
    );
    expect(tags).toContain('canonical');
    expect(tags).toContain('og:');
    expect(tags).toContain('twitter:');
  });

  it('gives every page its icons and a dataset preload', () => {
    const plugin = siteHead();
    resolveConfig(plugin, 'build', '/base/');
    const tags = JSON.stringify(
      hook(plugin, 'transformIndexHtml')(HTML, {
        path: PAGE_PATH,
      }),
    );
    expect(tags).toContain('/base/favicon.svg');
    expect(tags).toContain('theme-color');
    expect(tags).toContain('preload');
  });

  it('keeps an unlisted page out of search engines, and gives it no card', () => {
    const plugin = siteHead();
    resolveConfig(plugin, 'build', '/');
    const tags = JSON.stringify(
      hook(plugin, 'transformIndexHtml')(HTML, {
        path: '/debug/index.html',
      }),
    );
    expect(tags).toContain('noindex');
    expect(tags).not.toContain('og:title');
  });

  it('keeps an unknown file out of search engines too', () => {
    const plugin = siteHead();
    resolveConfig(plugin, 'build', '/');
    expect(
      JSON.stringify(
        hook(plugin, 'transformIndexHtml')(HTML, {
          path: '/nope.html',
        }),
      ),
    ).toContain('noindex');
  });

  it('emits a sitemap', () => {
    const plugin = siteHead();
    resolveConfig(plugin, 'build', '/bible-cross-references/');
    const emitted: { fileName?: string; source?: string }[] = [];
    const generate = plugin.generateBundle;
    const handler = typeof generate === 'function' ? generate : generate?.handler;
    void handler?.call(
      { emitFile: (file: { fileName?: string; source?: string }) => emitted.push(file) } as never,
      {} as never,
      {} as never,
      false,
    );
    const sitemap = emitted.find((file) => file.fileName === 'sitemap.xml');
    expect(sitemap?.source).toContain('<urlset');
  });
});

describe('offline', () => {
  it('emits a web app manifest that works under any base', () => {
    const plugin = offline();
    const emitted: { fileName?: string; source?: string }[] = [];
    const generate = plugin.generateBundle;
    const handler = typeof generate === 'function' ? generate : generate?.handler;
    void handler?.call(
      { emitFile: (file: { fileName?: string; source?: string }) => emitted.push(file) } as never,
      {} as never,
      {} as never,
      false,
    );
    const manifest = emitted.find((file) => file.fileName === 'manifest.webmanifest');
    const parsed: unknown = JSON.parse(manifest?.source ?? '{}');
    expect(parsed).toMatchObject({ start_url: './', scope: './', display: 'standalone' });
  });

  it('links the manifest from an app page of a build, and nowhere else', () => {
    const plugin = offline();
    resolveConfig(plugin, 'build', '/base/');
    const transform = hook(plugin, 'transformIndexHtml');
    expect(JSON.stringify(transform(HTML, { path: PAGE_PATH }))).toContain(
      '/base/manifest.webmanifest',
    );
    expect(transform(HTML, { path: '/debug/index.html' })).toEqual([]);
  });

  it('adds nothing on the dev server', () => {
    const plugin = offline();
    resolveConfig(plugin, 'serve', '/');
    expect(
      hook(plugin, 'transformIndexHtml')(HTML, {
        path: PAGE_PATH,
      }),
    ).toEqual([]);
  });

  it('writes a worker listing the files that are really on disk', async () => {
    // The bug this guards against: a worker that lists a file the build never wrote fails to
    // install, and the whole offline cache goes with it.
    const dir = await mkdtemp(join(tmpdir(), 'offline-test-'));
    await mkdir(join(dir, 'assets'), { recursive: true });
    await mkdir(join(dir, 'icons'), { recursive: true });
    await writeFile(join(dir, 'assets', 'main-abc.js'), 'console.log(1)');
    await writeFile(join(dir, 'assets', 'main-abc.css'), 'body{}');
    await writeFile(join(dir, 'assets', 'logo.woff2'), 'font');
    await writeFile(join(dir, 'manifest.webmanifest'), '{}');
    for (const icon of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) {
      await writeFile(join(dir, icon), 'x');
    }
    for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
      await writeFile(join(dir, 'icons', icon), 'x');
    }
    for (const page of Object.values(PAGES)) {
      await mkdir(join(dir, page.entry, '..'), { recursive: true });
      await writeFile(join(dir, page.entry), '<html></html>');
    }

    const plugin = offline();
    const write = plugin.writeBundle;
    const handler = typeof write === 'function' ? write : write?.handler;
    await handler?.call({} as never, { dir } as never, {} as never);

    const { readFile } = await import('node:fs/promises');
    const worker = await readFile(join(dir, 'sw.js'), 'utf8');
    const files = JSON.parse(/const FILES = (\[.*?\]);/s.exec(worker)?.[1] ?? '[]') as string[];
    expect(files).toContain('assets/main-abc.js');
    expect(files).toContain('assets/main-abc.css');
    // Anything the bundler emits, not only code and styles.
    expect(files).toContain('assets/logo.woff2');
    expect(files).toContain('manifest.webmanifest');
    expect(files).not.toContain('sw.js');
    expect(worker).toContain('const VERSION = "');
    expect(worker).toContain('const PAGES = ');
  });
});
