import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OutgoingIcon } from '../../../shared/ui/icons.tsx';
import { PanelSection } from './PanelSection.tsx';

function renderSection(props: Partial<Parameters<typeof PanelSection>[0]> = {}) {
  return render(
    <PanelSection
      id="references"
      icon={OutgoingIcon}
      title="References"
      description="where this passage points"
      {...props}
    >
      <p>the body</p>
    </PanelSection>,
  );
}

describe('PanelSection', () => {
  it('names the section and says what it holds', () => {
    renderSection();
    const toggle = screen.getByRole('button');
    expect(toggle.textContent).toContain('References');
    expect(toggle.textContent).toContain('where this passage points');
  });

  it('is a heading, so the panel can be navigated by its sections', () => {
    renderSection();
    expect(screen.getByRole('heading')).toBeDefined();
  });

  it('starts open, showing its body', () => {
    renderSection();
    expect(screen.getByText('the body')).toBeDefined();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('can start closed', () => {
    renderSection({ defaultOpen: false });
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('the body').closest('[hidden]')).not.toBeNull();
  });

  it('opens and closes when its band is used', async () => {
    renderSection();
    const toggle = screen.getByRole('button');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('points the band at the body it controls', () => {
    renderSection();
    const controls = screen.getByRole('button').getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls ?? '')?.textContent).toBe('the body');
  });

  it('remembers being closed, so the choice outlasts the visit', async () => {
    const first = renderSection();
    await userEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('bible-cross-references:panel:references')).toBe('false');
    first.unmount();

    renderSection();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('remembers each section separately', async () => {
    renderSection({ id: 'same-word', title: 'Same Greek word' });
    await userEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('bible-cross-references:panel:same-word')).toBe('false');
    expect(localStorage.getItem('bible-cross-references:panel:references')).toBeNull();
  });

  it('shows a count when there is one to show, and names what it counts', () => {
    renderSection({ count: 1234, countLabel: 'passages' });
    const toggle = screen.getByRole('button');
    expect(toggle.textContent).toContain('1,234');
    expect(toggle.textContent).toContain('passages');
  });

  it('shows no count where a count would mean nothing', () => {
    renderSection();
    expect(screen.getByRole('button').textContent).not.toMatch(/\d/);
  });

  it('shows a count of zero rather than hiding it', () => {
    renderSection({ count: 0, countLabel: 'passages' });
    expect(screen.getByRole('button').textContent).toContain('0');
  });

  it("makes room for something of the caller's between the name and the count", () => {
    renderSection({ trailing: <span data-testid="strip" />, count: 3 });
    expect(screen.getByTestId('strip')).toBeDefined();
  });
});
