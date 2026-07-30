import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SharedItemCardComponent } from '../shared-item-card/shared-item-card.component';
import { SharedItem, SharingGroup } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { categoryFilterOptions, filterSharedItems, groupFilterOptions } from '../functions';

@Component({
  selector: 'app-browse-page',
  imports: [PageLayout, RouterLink, SharedItemCardComponent],
  templateUrl: './browse-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class BrowsePageComponent {
  readonly #api = inject(SharingApi);
  readonly session = inject(SessionStore);
  readonly sharedItems = signal<readonly SharedItem[]>([]);
  readonly groups = signal<readonly SharingGroup[]>([]);
  readonly selectedGroupId = signal('');
  readonly selectedCategory = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly groupOptions = computed(() => groupFilterOptions(this.groups()));
  readonly categoryOptions = computed(() => categoryFilterOptions(this.sharedItems()));
  readonly filteredItems = computed(() =>
    filterSharedItems(this.sharedItems(), this.selectedGroupId(), this.selectedCategory()),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [items, groups] = await Promise.all([
        this.#api.listGlobalSharedItems(),
        this.#api.listGroups(),
      ]);
      this.sharedItems.set(items.sharedItems);
      this.groups.set(groups.sharingGroups);
    } catch {
      this.error.set('We could not load Browse.');
    } finally {
      this.loading.set(false);
    }
  }

  ownerName(item: SharedItem): string {
    return item.owner.id === this.session.user()?.id ? 'You' : item.owner.displayName;
  }
}
