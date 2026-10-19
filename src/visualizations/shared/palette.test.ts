import { describe, expect, it } from 'vitest';
import { GENRES } from '../../core/bible/genres.ts';
import { GENRE_COLORS, GENRE_HEX, GENRE_RGB, hexToRgb, VIZ_SURFACE } from './palette.ts';

describe('hexToRgb', () => {
  it('splits a colour into channels in [0, 1]', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });

  it('accepts either case', () => {
    expect(hexToRgb('#AABBCC')).toEqual(hexToRgb('#aabbcc'));
  });

  it('refuses anything that is not a six-digit hex colour', () => {
    for (const bad of ['#fff', 'ffffff', '#gggggg', '', '#ffffff ']) {
      expect(() => hexToRgb(bad)).toThrow(/Invalid hex color/);
    }
  });
});

describe('the genre palette', () => {
  it('has a colour for every genre', () => {
    expect(Object.keys(GENRE_COLORS)).toHaveLength(GENRES.length);
    for (const genre of GENRES) {
      expect(GENRE_COLORS[genre.id]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('indexes the same colours by ordinal for WebGL and for Canvas', () => {
    expect(GENRE_RGB).toHaveLength(GENRES.length);
    expect(GENRE_HEX).toHaveLength(GENRES.length);
    for (const genre of GENRES) {
      expect(GENRE_HEX[genre.ordinal]).toBe(GENRE_COLORS[genre.id]);
      expect(GENRE_RGB[genre.ordinal]).toEqual(hexToRgb(GENRE_COLORS[genre.id]));
    }
  });

  it('gives each genre its own colour', () => {
    expect(new Set(Object.values(GENRE_COLORS)).size).toBe(GENRES.length);
  });

  it('draws on the dark surface the app uses', () => {
    expect(VIZ_SURFACE).toBe('#0d0d0d');
  });
});
