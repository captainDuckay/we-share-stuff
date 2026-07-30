import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemePreferenceStorage } from './functions';
import { THEME_PREFERENCE_STORAGE, ThemePreferenceStore } from './theme-preference.store';

const createStorage = (storedPreference: string | null = null) => {
  const getItem = vi.fn(() => storedPreference);
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const storage: ThemePreferenceStorage = { getItem, setItem, removeItem };
  return { storage, setItem, removeItem };
};

const createStore = (storage: ThemePreferenceStorage): ThemePreferenceStore => {
  TestBed.configureTestingModule({
    providers: [{ provide: THEME_PREFERENCE_STORAGE, useValue: storage }],
  });
  return TestBed.inject(ThemePreferenceStore);
};

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  TestBed.resetTestingModule();
});

describe('ThemePreferenceStore', () => {
  it('uses browser preference by default', () => {
    const { storage } = createStorage();
    const store = createStore(storage);
    TestBed.tick();

    expect(store.preference()).toBe('browser');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('restores and applies a saved explicit preference', () => {
    const { storage } = createStorage('dark');
    const store = createStore(storage);
    TestBed.tick();

    expect(store.preference()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('applies and persists a changed explicit preference', () => {
    const { storage, setItem } = createStorage();
    const store = createStore(storage);
    TestBed.tick();

    store.setPreference('light');
    TestBed.tick();

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(setItem).toHaveBeenLastCalledWith('theme-preference', 'light');
  });

  it('returns to browser preference and removes the saved override', () => {
    const { storage, removeItem } = createStorage('dark');
    const store = createStore(storage);
    TestBed.tick();

    store.setPreference('browser');
    TestBed.tick();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(removeItem).toHaveBeenLastCalledWith('theme-preference');
  });
});
