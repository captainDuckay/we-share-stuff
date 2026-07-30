import { describe, expect, it } from 'vitest';
import { internalReturnUrl } from './functions';

describe('internalReturnUrl', () => {
  it('does not permit external redirects', () => {
    expect(internalReturnUrl('//evil.example')).toBe('/home');
    expect(internalReturnUrl('/home')).toBe('/home');
  });
});
