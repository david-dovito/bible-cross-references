import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Every test starts with an empty document and no stored state left by the last one.
 *
 * A test may replace `localStorage` with a stub of its own and take it away again, so this
 * checks rather than assumes.
 */
afterEach(() => {
  cleanup();
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
});
