import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notification } from '../../../core/api/model';
import { notificationKindLabel } from '../../../core/notifications/functions';

@Component({
  selector: 'a[app-notification-center-item]',
  hostDirectives: [
    { directive: RouterLink, inputs: ['routerLink', 'queryParams'] },
  ],
  host: {
    class: 'nc-item',
    '[class.nc-item--unread]': 'isUnread()',
  },
  templateUrl: './notification-center-item.html',
  styleUrl: './notification-center-item.css',
})
export class NotificationCenterItem {
  readonly notification = input.required<Notification>();

  readonly isUnread = computed(() => this.notification().attention === 'unread');
  readonly kindLabel = computed(() => notificationKindLabel(this.notification().kind));
}
