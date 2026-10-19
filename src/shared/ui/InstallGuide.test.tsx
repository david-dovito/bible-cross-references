import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallGuideDialog, InstallLink } from './InstallGuide.tsx';

/** happy-dom has no top layer; these make <dialog> behave enough to test against. */
function stubDialog(): void {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

function renderGuide() {
  return render(
    <>
      <InstallLink />
      <InstallGuideDialog />
    </>,
  );
}

/** A closed dialog hides its contents from the accessibility tree, so open it before looking. */
async function openGuide() {
  const result = renderGuide();
  await userEvent.click(screen.getByRole('button', { name: 'Install the app' }));
  return result;
}

const dialog = () => document.querySelector('dialog');

beforeEach(() => {
  stubDialog();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the footer link', () => {
  it('is named even where only the arrow shows', () => {
    render(<InstallLink />);
    expect(screen.getByRole('button', { name: 'Install the app' })).toBeDefined();
  });

  it('opens the guide', async () => {
    renderGuide();
    expect(dialog()?.open).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Install the app' }));
    expect(dialog()?.open).toBe(true);
  });

  it('does nothing when no guide is mounted, rather than failing', async () => {
    render(<InstallLink />);
    await expect(
      userEvent.click(screen.getByRole('button', { name: 'Install the app' })),
    ).resolves.toBeUndefined();
  });
});

describe('the guide', () => {
  it('is labelled by its own heading', async () => {
    await openGuide();
    expect(dialog()?.getAttribute('aria-labelledby')).toBe('install-guide-title');
    expect(screen.getByRole('heading', { name: 'Install the app' }).id).toBe('install-guide-title');
  });

  it('offers the three devices, with one of them chosen', async () => {
    await openGuide();
    const devices = screen.getByRole('group', { name: 'Device' });
    const chosen = within(devices)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(within(devices).getAllByRole('button')).toHaveLength(3);
    expect(chosen).toHaveLength(1);
  });

  it('shows the steps for the device chosen, and swaps them', async () => {
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: /^iPhone$/ }));
    expect(screen.getByText(/Add to Home Screen/)).toBeDefined();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Desktop$/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/address bar/)).toBeDefined();
  });

  it('says what Safari on a Mac and Firefox do, on the desktop steps', async () => {
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: /^Desktop$/ }));
    expect(screen.getByText(/Add to Dock/)).toBeDefined();
    expect(screen.getByText(/Firefox installs no web apps/)).toBeDefined();
  });

  it('tells an iPhone reader that other browsers offer it too', async () => {
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: /^iPhone$/ }));
    expect(screen.getByText(/Chrome, Edge and Firefox/)).toBeDefined();
  });

  it('closes from its own close button', async () => {
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog()?.open).toBe(false);
  });

  it('says to open it once online, which is when it stores what it needs', async () => {
    await openGuide();
    expect(screen.getByText(/once while you are online/)).toBeDefined();
  });
});

describe('the #install address', () => {
  it('opens the guide on arrival', () => {
    window.history.replaceState(null, '', '/#install');
    renderGuide();
    expect(dialog()?.open).toBe(true);
  });

  it('opens it when the address changes while the page is open', () => {
    renderGuide();
    expect(dialog()?.open).toBe(false);
    window.history.replaceState(null, '', '/#install');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(dialog()?.open).toBe(true);
  });

  it('ignores any other fragment', () => {
    window.history.replaceState(null, '', '/#somewhere-else');
    renderGuide();
    expect(dialog()?.open).toBe(false);
  });

  it("takes the fragment back out when closed, keeping the reader's passage", async () => {
    window.history.replaceState(null, '', '/?ref=John.3.16&t=kjv#install');
    renderGuide();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?ref=John.3.16&t=kjv');
  });

  it('leaves the address alone when the guide was opened from the link', async () => {
    window.history.replaceState(null, '', '/?ref=John.3.16');
    renderGuide();
    await userEvent.click(screen.getByRole('button', { name: 'Install the app' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(window.location.search).toBe('?ref=John.3.16');
  });
});

describe('the browser’s own install offer', () => {
  /** Chromium's offer, which the app holds back so the footer can replay it. */
  function offerInstall() {
    const prompt = vi.fn(() => Promise.resolve({ outcome: 'accepted' }));
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
    act(() => {
      window.dispatchEvent(event);
    });
    return { prompt, event };
  }

  afterEach(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });

  it('keeps the browser from showing an install bar of its own', () => {
    const { event } = offerInstall();
    expect(event.defaultPrevented).toBe(true);
  });

  it('offers to install from the guide once the browser has made the offer', async () => {
    offerInstall();
    await openGuide();
    expect(screen.getByRole('button', { name: /Install now/ })).toBeDefined();
  });

  it('does not offer it where the browser has not', async () => {
    await openGuide();
    expect(screen.queryByRole('button', { name: /Install now/ })).toBeNull();
  });

  it('asks the browser to install when the offer is taken', async () => {
    const { prompt } = offerInstall();
    await openGuide();
    await userEvent.click(screen.getByRole('button', { name: /Install now/ }));
    expect(prompt).toHaveBeenCalled();
  });

  it('withdraws the offer once the app is installed', async () => {
    offerInstall();
    await openGuide();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: /Install now/ })).toBeNull();
  });

  it('closes on a click outside the dialog, but not on one inside it', async () => {
    await openGuide();
    const element = dialog();
    if (!element) {
      throw new Error('Expected the dialog.');
    }
    element.getBoundingClientRect = () =>
      ({ top: 100, right: 300, bottom: 300, left: 100 }) as DOMRect;
    element.dispatchEvent(
      Object.assign(new MouseEvent('click', { bubbles: true }), { clientX: 200, clientY: 200 }),
    );
    expect(element.open).toBe(true);
    element.dispatchEvent(
      Object.assign(new MouseEvent('click', { bubbles: true }), { clientX: 10, clientY: 10 }),
    );
    expect(element.open).toBe(false);
  });

  it('stays open when a double click lands on the backdrop', async () => {
    await openGuide();
    const element = dialog();
    if (!element) {
      throw new Error('Expected the dialog.');
    }
    element.getBoundingClientRect = () =>
      ({ top: 100, right: 300, bottom: 300, left: 100 }) as DOMRect;
    element.dispatchEvent(
      Object.assign(new MouseEvent('click', { bubbles: true, detail: 2 }), {
        clientX: 10,
        clientY: 10,
      }),
    );
    expect(element.open).toBe(true);
  });
});
