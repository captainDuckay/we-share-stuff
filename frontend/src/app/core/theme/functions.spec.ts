import { describe, expect, it, vi } from 'vitest';
import {
  persistThemePreference,
  readThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  themePreferenceFromStorage,
  ThemePreferenceStorage,
} from './functions';

const storageThatThrows = (): ThemePreferenceStorage => ({
  getItem: () => {
    throw new Error('Storage unavailable');
  },
  setItem: () => {
    throw new Error('Storage unavailable');
  },
  removeItem: () => {
    throw new Error('Storage unavailable');
  },
});

describe('theme preference functions', () => {
  it('defaults missing and invalid stored values to the browser preference', () => {
    expect(themePreferenceFromStorage(null)).toBe('browser');
    expect(themePreferenceFromStorage('sepia')).toBe('browser');
  });

  it('accepts stored theme preferences', () => {
    expect(themePreferenceFromStorage('light')).toBe('light');
    expect(themePreferenceFromStorage('dark')).toBe('dark');
  });

  it('defaults to the browser preference when storage is unavailable', () => {
    expect(readThemePreference(storageThatThrows())).toBe('browser');
  });

  it('removes the stored override for the browser preference', () => {
    const removeItem = vi.fn();
    persistThemePreference({ getItem: vi.fn(), setItem: vi.fn(), removeItem }, 'browser');
    expect(removeItem).toHaveBeenCalledWith(THEME_PREFERENCE_STORAGE_KEY);
  });

  it('persists an explicit preference', () => {
    const setItem = vi.fn();
    persistThemePreference({ getItem: vi.fn(), setItem, removeItem: vi.fn() }, 'dark');
    expect(setItem).toHaveBeenCalledWith(THEME_PREFERENCE_STORAGE_KEY, 'dark');
  });
});
