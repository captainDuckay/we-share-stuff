import { TypicalLocation, TypicalLocationInput } from '../../core/api/model';

export interface FileLike {
  readonly type: string;
  readonly size: number;
}

export const DISPLAY_NAME_MAX_LENGTH = 200;
export const LOCATION_NAME_MAX_LENGTH = 200;
export const LOCATION_DETAILS_MAX_LENGTH = 2_000;
export const TIMEZONE_MAX_LENGTH = 100;
export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const SUPPORTED_PROFILE_PHOTO_TYPES = new Set(PROFILE_PHOTO_ACCEPT.split(','));

export const profilePhotoInputError = (file: FileLike | null): string => {
  if (!file) return 'Choose a Profile Photo to upload.';
  if (!SUPPORTED_PROFILE_PHOTO_TYPES.has(file.type)) return 'Choose a JPEG, PNG, or WebP image.';
  if (file.size <= 0) return 'Choose an image that is not empty.';
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return 'Choose an image smaller than 10 MB.';
  return '';
};

export const defaultTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const locationFormModel = (location?: TypicalLocation) => ({
  name: location?.name ?? '',
  details: location?.details ?? '',
  timezone: location?.timezone ?? defaultTimezone(),
});

export const typicalLocationInput = (
  model: ReturnType<typeof locationFormModel>,
): TypicalLocationInput => ({
  name: model.name.trim(),
  details: model.details.trim() || null,
  timezone: model.timezone.trim(),
});
