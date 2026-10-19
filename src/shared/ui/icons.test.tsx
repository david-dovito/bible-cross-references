import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as icons from './icons.tsx';

const ALL = Object.entries(icons).filter(
  (entry): entry is [string, icons.IconComponent] => typeof entry[1] === 'function',
);

describe('the icon set', () => {
  it('exports icons', () => {
    expect(ALL.length).toBeGreaterThan(20);
  });

  it.each(ALL)('%s renders one glyph, hidden from assistive technology', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // The text around an icon, or its control's name, already says what it means.
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(ALL)('%s takes an extra class beside its own', (_name, Icon) => {
    const { container } = render(<Icon className="extra" />);
    const className = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(className).toContain('extra');
    expect(className.split(' ').length).toBeGreaterThan(1);
  });
});
