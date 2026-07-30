import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { displayNameInitials } from './functions';

@Component({
  selector: 'app-user-avatar, button[app-user-avatar]',
  imports: [],
  templateUrl: './user-avatar.html',
  styleUrl: './user-avatar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatar {
  readonly displayName = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly initials = computed(() => displayNameInitials(this.displayName()));
}
