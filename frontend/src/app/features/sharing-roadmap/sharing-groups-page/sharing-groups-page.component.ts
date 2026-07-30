import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SharedItem, SharingGroup, SharingGroupMember } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  DEFAULT_SHARING_GROUP_ICON,
  friendlyApiError,
  GROUP_MEMBER_INITIAL_LIMIT,
  normalizeNameInput,
  remainingMemberCount,
} from '../functions';

@Component({
  selector: 'app-sharing-groups-page',
  imports: [MaterialSymbolIconComponent, PageLayout, ReactiveFormsModule, RouterLink, UserAvatar],
  templateUrl: './sharing-groups-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class SharingGroupsPageComponent {
  readonly #api = inject(SharingApi);
  readonly defaultSharingGroupIcon = DEFAULT_SHARING_GROUP_ICON;
  readonly groups = signal<readonly SharingGroup[]>([]);
  readonly members = signal<Readonly<Record<string, readonly SharingGroupMember[]>>>({});
  readonly sharedItems = signal<Readonly<Record<string, readonly SharedItem[]>>>({});
  readonly loading = signal(true);
  readonly error = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  constructor() {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const groups = await this.#api.listGroups();
      this.groups.set(groups.sharingGroups);
      await Promise.all(
        groups.sharingGroups.map(async (group) => {
          const [members, sharedItems] = await Promise.all([
            this.#api.listMembers(group.id),
            this.#api.listSharedItems(group.id),
          ]);
          this.members.update((record) => ({ ...record, [group.id]: members.members }));
          this.sharedItems.update((record) => ({ ...record, [group.id]: sharedItems.sharedItems }));
        }),
      );
    } catch {
      this.error.set('We could not load Sharing groups.');
    } finally {
      this.loading.set(false);
    }
  }
  async create(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      await this.#api.createGroup(normalizeNameInput(this.form.controls.name.value));
      this.form.reset({ name: '' });
      await this.load();
    } catch (error) {
      this.error.set(friendlyApiError(error, 'We could not create that Sharing Group.'));
    }
  }
  visibleMembers(group: SharingGroup): readonly SharingGroupMember[] {
    return (this.members()[group.id] ?? []).slice(0, GROUP_MEMBER_INITIAL_LIMIT);
  }
  remaining(group: SharingGroup): number {
    return remainingMemberCount(this.members()[group.id] ?? []);
  }
  sharedItemCount(group: SharingGroup): number {
    return this.sharedItems()[group.id]?.length ?? 0;
  }
}
