import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InAppLink } from './InAppLink.tsx';

describe('InAppLink', () => {
  it('is a real link, so it can be opened in a new tab or copied', () => {
    render(
      <InAppLink href="/threads/?ref=John.3.16" onFollow={vi.fn()}>
        Threads
      </InAppLink>,
    );
    expect(screen.getByRole('link', { name: 'Threads' })).toHaveProperty(
      'href',
      expect.stringContaining('/threads/?ref=John.3.16'),
    );
  });

  it('navigates in place on a plain click, without loading the page again', () => {
    const onFollow = vi.fn();
    render(
      <InAppLink href="/x" onFollow={onFollow}>
        go
      </InAppLink>,
    );
    const link = screen.getByRole('link', { name: 'go' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(event);
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a modified click to the browser, so Cmd-click opens a tab', () => {
    const onFollow = vi.fn();
    render(
      <InAppLink href="/x" onFollow={onFollow}>
        go
      </InAppLink>,
    );
    const link = screen.getByRole('link', { name: 'go' });
    for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        [modifier]: true,
      });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('leaves a middle click alone', () => {
    const onFollow = vi.fn();
    render(
      <InAppLink href="/x" onFollow={onFollow}>
        go
      </InAppLink>,
    );
    screen
      .getByRole('link', { name: 'go' })
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 }));
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('does nothing when something else has already handled the click', () => {
    const onFollow = vi.fn();
    render(
      <div
        onClickCapture={(event) => {
          event.preventDefault();
        }}
      >
        <InAppLink href="/x" onFollow={onFollow}>
          go
        </InAppLink>
      </div>,
    );
    screen
      .getByRole('link', { name: 'go' })
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('passes its other attributes through', () => {
    render(
      <InAppLink href="/x" aria-current="page" className="c" onFollow={vi.fn()}>
        go
      </InAppLink>,
    );
    const link = screen.getByRole('link', { name: 'go' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.className).toBe('c');
  });
});
