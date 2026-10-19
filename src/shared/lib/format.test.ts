import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDecimal,
  formatDuration,
  formatInteger,
  formatShare,
} from './format.ts';

describe('formatInteger', () => {
  it('groups thousands', () => {
    expect(formatInteger(344799)).toBe('344,799');
    expect(formatInteger(0)).toBe('0');
    expect(formatInteger(-1234)).toBe('-1,234');
  });
});

describe('formatDecimal', () => {
  it('keeps at most two decimals', () => {
    expect(formatDecimal(1.005)).toBe('1.01');
    expect(formatDecimal(1.236)).toBe('1.24');
    expect(formatDecimal(2)).toBe('2');
    expect(formatDecimal(1000)).toBe('1,000');
  });
});

describe('formatShare', () => {
  it('reads as a percentage', () => {
    expect(formatShare(1, 2)).toBe('50%');
    expect(formatShare(1, 3)).toBe('33.3%');
  });

  it('says nothing rather than dividing by zero', () => {
    expect(formatShare(5, 0)).toBe('—');
  });
});

describe('formatBytes', () => {
  it('climbs through the units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });

  it('stops at the largest unit it knows', () => {
    expect(formatBytes(1024 ** 4)).toBe('1,024 GB');
  });
});

describe('formatDuration', () => {
  it('uses milliseconds below a second and seconds above', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(999.6)).toBe('1000 ms');
    expect(formatDuration(1000)).toBe('1 s');
    expect(formatDuration(1500)).toBe('1.5 s');
  });
});
