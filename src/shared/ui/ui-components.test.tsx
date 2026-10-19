import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Bar } from './Bar.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { KeyValueList } from './KeyValueList.tsx';
import { Section } from './Section.tsx';

describe('Bar', () => {
  it('fills in proportion to the maximum', () => {
    render(<Bar value={1} max={4} label="a quarter" />);
    const bar = screen.getByRole('img', { name: 'a quarter' });
    expect(bar.firstElementChild).toHaveProperty('style.inlineSize', '25%');
  });

  it('stays empty rather than dividing by zero', () => {
    render(<Bar value={5} max={0} label="nothing yet" />);
    expect(screen.getByRole('img', { name: 'nothing yet' }).firstElementChild).toHaveProperty(
      'style.inlineSize',
      '0%',
    );
  });

  it('is named for assistive technology, since the bar itself says nothing', () => {
    render(<Bar value={3} max={3} label="all of them" />);
    expect(screen.getByRole('img', { name: 'all of them' })).toBeDefined();
  });
});

describe('Section', () => {
  it('is labelled by its own heading', () => {
    render(
      <Section id="data" title="Datasets">
        <p>body</p>
      </Section>,
    );
    const section = screen.getByRole('region', { name: 'Datasets' });
    expect(section.id).toBe('data');
    expect(screen.getByRole('heading', { name: 'Datasets' }).id).toBe('data-title');
  });

  it('shows a description only when there is one', () => {
    const { rerender } = render(
      <Section id="x" title="T">
        <p>body</p>
      </Section>,
    );
    expect(screen.queryByText('what this is')).toBeNull();
    rerender(
      <Section id="x" title="T" description="what this is">
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText('what this is')).toBeDefined();
  });
});

describe('KeyValueList', () => {
  it('pairs every label with its value', () => {
    render(
      <KeyValueList
        items={[
          { label: 'Verses', value: '31,102' },
          { label: 'Links', value: 7 },
        ]}
      />,
    );
    expect(screen.getByText('Verses')).toBeDefined();
    expect(screen.getByText('31,102')).toBeDefined();
    expect(screen.getByText('Links')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<KeyValueList items={[]} />);
    expect(container.querySelectorAll('dt')).toHaveLength(0);
  });
});

describe('ErrorBoundary', () => {
  function Boom({ fail }: { readonly fail: boolean }) {
    if (fail) {
      throw new Error('render failed');
    }
    return <p>all well</p>;
  }

  it('shows the children while they render', () => {
    render(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <Boom fail={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('all well')).toBeDefined();
  });

  it('shows the fallback, with the error, when they do not', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary fallback={(caught) => <p>caught: {caught.message}</p>}>
        <Boom fail />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: render failed')).toBeDefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('can be reset, so the children get another go', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Flaky() {
      return (
        <ErrorBoundary fallback={(_caught, reset) => <button onClick={reset}>try again</button>}>
          <Boom fail={false} />
        </ErrorBoundary>
      );
    }
    render(<Flaky />);
    expect(screen.getByText('all well')).toBeDefined();
    error.mockRestore();
  });

  it('wraps a thrown non-Error so the fallback always gets one', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function ThrowsString(): never {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- the case under test
      throw 'just a string';
    }
    render(
      <ErrorBoundary fallback={(caught) => <p>{caught.message}</p>}>
        <ThrowsString />
      </ErrorBoundary>,
    );
    expect(screen.getByText('just a string')).toBeDefined();
    error.mockRestore();
  });
});
