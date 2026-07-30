import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { ProfileSection } from '../profile-section/profile-section';
import { ThemePreferenceSection } from '../theme-preference-section/theme-preference-section';
import { TypicalLocationsSection } from '../typical-locations-section/typical-locations-section';

@Component({
  selector: 'app-my-page',
  imports: [PageLayout, ProfileSection, ThemePreferenceSection, TypicalLocationsSection],
  templateUrl: './my-page.html',
  styleUrl: './my-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPage {}
