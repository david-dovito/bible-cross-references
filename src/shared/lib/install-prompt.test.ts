import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canPromptToInstall, promptToInstall, subscribeToInstallPrompt } from './install-prompt.ts';

/** What Chromium fires: an ordinary event carrying a `prompt()` method. */
function offerToInstall(prompt = vi.fn(() => Promise.resolve())): {
  event: Event;
  prompt: ReturnType<typeof vi.fn>;
} {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.defineProperty(event, 'prompt', { value: prompt });
  window.dispatchEvent(event);
  return { event, prompt };
}

beforeEach(() => {
  // Each test starts with no offer outstanding.
  window.dispatchEvent(new Event('appinstalled'));
});

describe("the browser's offer to install", () => {
  it('is not available until the browser makes one', () => {
    expect(canPromptToInstall()).toBe(false);
  });

  it('is available once the browser offers', () => {
    offerToInstall();
    expect(canPromptToInstall()).toBe(true);
  });

  it('keeps the browser from showing a bar of its own', () => {
    const { event } = offerToInstall();
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores an event without a prompt, which is not the one we mean', () => {
    window.dispatchEvent(new Event('beforeinstallprompt'));
    expect(canPromptToInstall()).toBe(false);
  });

  it('tells subscribers when it arrives and when it is used up', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToInstallPrompt(listener);
    offerToInstall();
    expect(listener).toHaveBeenCalledTimes(1);
    await promptToInstall();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    offerToInstall();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('asks the browser, once', async () => {
    const { prompt } = offerToInstall();
    await promptToInstall();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(canPromptToInstall()).toBe(false);
    await promptToInstall();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no offer to take', async () => {
    await expect(promptToInstall()).resolves.toBeUndefined();
  });

  it('survives a browser that refuses, and does not leave the offer dangling', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    offerToInstall(vi.fn(() => Promise.reject(new Error('already used'))));
    await expect(promptToInstall()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(canPromptToInstall()).toBe(false);
  });

  it('forgets the offer once the app is installed', () => {
    offerToInstall();
    window.dispatchEvent(new Event('appinstalled'));
    expect(canPromptToInstall()).toBe(false);
  });
});
