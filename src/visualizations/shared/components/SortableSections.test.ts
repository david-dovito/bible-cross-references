import { describe, expect, it } from 'vitest';
import { mergeOrder, orderSections } from './SortableSections.tsx';

const DEFAULT = ['connects-to', 'references', 'referenced-by', 'evidence', 'same-word'];

describe('orderSections', () => {
  it('keeps the default order until the reader moves something', () => {
    expect(orderSections(DEFAULT, [])).toEqual(DEFAULT);
  });

  it('follows the stored order', () => {
    expect(
      orderSections(DEFAULT, [
        'same-word',
        'evidence',
        'connects-to',
        'references',
        'referenced-by',
      ]),
    ).toEqual(['same-word', 'evidence', 'connects-to', 'references', 'referenced-by']);
  });

  it('puts a section the stored order never saw just after its default neighbour', () => {
    expect(
      orderSections(
        ['verses', ...DEFAULT],
        ['references', 'connects-to', 'referenced-by', 'evidence', 'same-word'],
      ),
    ).toEqual(['verses', 'references', 'connects-to', 'referenced-by', 'evidence', 'same-word']);
  });
});

describe('mergeOrder', () => {
  it('keeps the places of sections this passage lacks', () => {
    // A chapter has no words: moving its sections must not forget where the words go.
    expect(
      mergeOrder(['references', 'connects-to'], ['connects-to', 'references', 'same-word']),
    ).toEqual(['references', 'connects-to', 'same-word']);
  });
});
