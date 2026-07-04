import { describe, it, expect } from 'vitest';
import { codeFromUrl } from './urlParams.js';

describe('codeFromUrl', () => {
  it('returns a well-formed 4-digit code', () => {
    expect(codeFromUrl('?code=1234')).toBe('1234');
  });

  it('reads the code among other params', () => {
    expect(codeFromUrl('?foo=bar&code=5678&baz=1')).toBe('5678');
  });

  it('returns empty string when the param is absent', () => {
    expect(codeFromUrl('?other=1')).toBe('');
    expect(codeFromUrl('')).toBe('');
  });

  it('rejects codes that are not exactly four digits', () => {
    expect(codeFromUrl('?code=123')).toBe('');
    expect(codeFromUrl('?code=12345')).toBe('');
    expect(codeFromUrl('?code=12ab')).toBe('');
    expect(codeFromUrl('?code=')).toBe('');
  });

  it('does not throw on a malformed query string', () => {
    expect(codeFromUrl('%')).toBe('');
  });
});
