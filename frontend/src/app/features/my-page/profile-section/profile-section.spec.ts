import { describe, expect, it } from 'vitest';
import { profilePhotoInputError, PROFILE_PHOTO_MAX_BYTES } from '../functions';

describe('ProfileSection', () => {
  it('accepts supported Profile Photos', () => {
    expect(profilePhotoInputError({ type: 'image/jpeg', size: 1 })).toBe('');
  });

  it('rejects oversized Profile Photos', () => {
    expect(
      profilePhotoInputError({ type: 'image/png', size: PROFILE_PHOTO_MAX_BYTES + 1 }),
    ).toContain('smaller');
  });
});
