import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemePreference, THEME_PREFERENCES } from '../../../core/theme/functions';
import { ThemePreferenceStore } from '../../../core/theme/theme-preference.store';

interface ThemePreferenceOption {
  readonly value: ThemePreference;
  readonly label: string;
  readonly description: string;
}

const THEME_PREFERENCE_OPTION_COPY: Record<
  ThemePreference,
  Omit<ThemePreferenceOption, 'value'>
> = {
  browser: {
    label: 'Browser preference',
    description: 'Follow your browser or device appearance setting.',
  },
  light: {
    label: 'Light',
    description: 'Always use the light appearance.',
  },
  dark: {
    label: 'Dark',
    description: 'Always use the dark appearance.',
  },
};

const THEME_PREFERENCE_OPTIONS: readonly ThemePreferenceOption[] = THEME_PREFERENCES.map(
  (value) => ({ value, ...THEME_PREFERENCE_OPTION_COPY[value] }),
);

@Component({
  selector: 'app-theme-preference-section',
  imports: [],
  templateUrl: './theme-preference-section.html',
  styleUrl: './theme-preference-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePreferenceSection {
  readonly themePreference = inject(ThemePreferenceStore);
  readonly options = THEME_PREFERENCE_OPTIONS;

  selectPreference(preference: ThemePreference): void {
    this.themePreference.setPreference(preference);
  }
}
