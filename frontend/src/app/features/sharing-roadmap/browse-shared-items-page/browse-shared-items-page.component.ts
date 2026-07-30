import { Component, inject, signal } from '@angular/core';
import { SharedItem } from '../../../core/api/model';
import { SharingApi } from '../../../core/api/sharing-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { SharingPageSharedItemComponent } from '../sharing-page-shared-item/sharing-page-shared-item.component';

@Component({
  selector: 'app-browse-shared-items-page',
  imports: [SharingPageSharedItemComponent],
  templateUrl: './browse-shared-items-page.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class BrowseSharedItemsPageComponent {
  readonly #api = inject(SharingApi);
  readonly session = inject(SessionStore);
  readonly sharedItems = signal<readonly SharedItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.#api.listGlobalSharedItems();
      this.sharedItems.set(response.sharedItems);
    } catch {
      this.error.set('We could not load Shared Items.');
    } finally {
      this.loading.set(false);
    }
  }
}
