import { describe, expect, it } from 'vitest';
import { displayNameInitials } from './functions';

describe('displayNameInitials', () => {
  it('uses one initial for one word', () => {
    expect(displayNameInitials('Ada')).toBe('A');
  });

  it('uses the first and last words', () => {
    expect(displayNameInitials(' Ada Byron Lovelace ')).toBe('AL');
  });

  it('does not require an email fallback', () => {
    expect(displayNameInitials('')).toBe('?');
  });
});
