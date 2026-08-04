import { Component, computed, HostListener, inject } from '@angular/core';
import { Notification } from '../../core/api/model';
import { resolveDeepLink } from '../../core/notifications/functions';
import { NotificationInboxStore } from '../../core/notifications/notification-inbox.store';
import { NotificationRouteTarget } from '../../core/notifications/types';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';
import { NotificationCenterItem } from './notification-center-item/notification-center-item';

type LinkableNotification = NotificationRouteTarget & {
  readonly notification: Notification;
};

@Component({
  selector: 'app-notification-center',
  imports: [MaterialSymbolIconComponent, NotificationCenterItem],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.css',
})
export class NotificationCenter {
  readonly inbox = inject(NotificationInboxStore);

  /** Rows with a resolvable deep link; unmapped surfaces are omitted. */
  readonly linkableItems = computed((): readonly LinkableNotification[] =>
    this.inbox.list().flatMap((notification) => {
      const target = resolveDeepLink(notification.deepLink);
      if (!target) return [];
      return [
        {
          notification,
          commands: target.commands,
          queryParams: target.queryParams,
        },
      ];
    }),
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.inbox.centerOpen()) {
      this.inbox.closeCenter();
    }
  }
}
