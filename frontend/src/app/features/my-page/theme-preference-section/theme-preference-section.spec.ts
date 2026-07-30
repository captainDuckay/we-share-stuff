import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { THEME_PREFERENCES, ThemePreference } from '../../../core/theme/functions';
import { ThemePreferenceStore } from '../../../core/theme/theme-preference.store';
import { ThemePreferenceSection } from './theme-preference-section';

describe('ThemePreferenceSection', () => {
  it('shows every preference and updates the selected preference', async () => {
    const preference = signal<ThemePreference>('browser');
    const setPreference = vi.fn((value: ThemePreference) => preference.set(value));
    TestBed.configureTestingModule({
      imports: [ThemePreferenceSection],
      providers: [
        {
          provide: ThemePreferenceStore,
          useValue: { preference: preference.asReadonly(), setPreference },
        },
      ],
    });
    const fixture = TestBed.createComponent(ThemePreferenceSection);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const darkInput = inputs.find(({ value }) => value === 'dark');

    expect(inputs).toHaveLength(THEME_PREFERENCES.length);
    expect(darkInput).toBeDefined();

    darkInput?.click();
    await fixture.whenStable();

    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(preference()).toBe('dark');
  });
});
