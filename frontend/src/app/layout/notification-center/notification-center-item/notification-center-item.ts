import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notification } from '../../../core/api/model';
import { notificationKindLabel } from '../../../core/notifications/functions';
import { NotificationInboxStore } from '../../../core/notifications/notification-inbox.store';

@Component({
  selector: 'a[app-notification-center-item]',
  hostDirectives: [
    { directive: RouterLink, inputs: ['routerLink', 'queryParams'] },
  ],
  host: {
    class: 'nc-item',
    '[class.nc-item--unread]': 'isUnread()',
    '(click)': 'onNavigate()',
  },
  templateUrl: './notification-center-item.html',
  styleUrl: './notification-center-item.css',
})
export class NotificationCenterItem {
  readonly #inbox = inject(NotificationInboxStore);

  readonly notification = input.required<Notification>();

  readonly isUnread = computed(() => this.notification().attention === 'unread');
  readonly kindLabel = computed(() => notificationKindLabel(this.notification().kind));

  /** Close Center chrome only; routerLink owns navigation; does not mark Read. */
  onNavigate(): void {
    this.#inbox.activateNotification();
  }
}
