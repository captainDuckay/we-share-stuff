export const THEME_PREFERENCE_STORAGE_KEY = 'theme-preference';
export const THEME_PREFERENCES = ['browser', 'light', 'dark'] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface ThemePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const themePreferenceFromStorage = (value: string | null): ThemePreference =>
  THEME_PREFERENCES.find((preference) => preference === value) ?? 'browser';

export const readThemePreference = (storage: ThemePreferenceStorage | null): ThemePreference => {
  try {
    return themePreferenceFromStorage(storage?.getItem(THEME_PREFERENCE_STORAGE_KEY) ?? null);
  } catch {
    return 'browser';
  }
};

export const persistThemePreference = (
  storage: ThemePreferenceStorage | null,
  preference: ThemePreference,
): void => {
  try {
    if (preference === 'browser') {
      storage?.removeItem(THEME_PREFERENCE_STORAGE_KEY);
      return;
    }

    storage?.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // The preference still applies for this session when browser storage is unavailable.
  }
};
