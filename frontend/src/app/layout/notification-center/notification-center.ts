import { Component, HostListener, inject } from '@angular/core';
import { NotificationInboxStore } from '../../core/notifications/notification-inbox.store';
import { notificationKindLabel } from '../../core/notifications/functions';
import { Notification } from '../../core/api/model';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';

@Component({
  selector: 'app-notification-center',
  imports: [MaterialSymbolIconComponent],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.css',
})
export class NotificationCenter {
  readonly inbox = inject(NotificationInboxStore);
  readonly kindLabel = notificationKindLabel;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.inbox.centerOpen()) {
      this.inbox.closeCenter();
    }
  }

  onOpenItem(notification: Notification): void {
    void this.inbox.openNotification(notification);
  }
}
