import { describe, expect, it } from 'vitest';
import {
  availableTranslationManifests,
  getTranslationManifest,
  isTranslationAvailable,
} from './registry.ts';

describe('licensed translations', () => {
  it('the NASB is licensed and carries Lockman’s notice', () => {
    const nasb = getTranslationManifest('nasb');
    expect(nasb.access).toBe('licensed');
    expect(nasb.attribution).toBe(
      'Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © ' +
        '1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission. All rights ' +
        'reserved. lockman.org',
    );
  });

  it('the picker leaves the NASB out of a build without its file', () => {
    expect(availableTranslationManifests([]).map(({ id }) => id)).toEqual([
      'bsb',
      'msb',
      'kjv',
      'asv',
      'web',
    ]);
    expect(isTranslationAvailable('nasb', [])).toBe(false);
    expect(isTranslationAvailable('bsb', [])).toBe(true);
  });

  it('the picker offers the NASB once it was built', () => {
    expect(availableTranslationManifests(['nasb']).map(({ id }) => id)).toEqual([
      'bsb',
      'msb',
      'kjv',
      'asv',
      'web',
      'nasb',
    ]);
  });
});
