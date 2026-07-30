import { describe, expect, it } from 'vitest';
import { displayNameInitials } from '../../user-avatar/user-avatar/functions';

describe('MyPage', () => {
  it('uses Display Name initials for the profile fallback', () => {
    expect(displayNameInitials('Ada Lovelace')).toBe('AL');
  });
});
