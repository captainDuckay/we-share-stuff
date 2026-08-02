import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  NotificationEnvelope,
  NotificationsEnvelope,
  UnreadCountEnvelope,
} from './model';

export interface NotificationsListParams {
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  readonly #http = inject(HttpClient);

  list = (params: NotificationsListParams = {}): Promise<NotificationsEnvelope> => {
    let httpParams = new HttpParams();
    if (params.limit !== undefined) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.offset !== undefined) {
      httpParams = httpParams.set('offset', String(params.offset));
    }
    return firstValueFrom(
      this.#http.get<NotificationsEnvelope>('/api/notifications', { params: httpParams }),
    );
  };

  unreadCount = (): Promise<UnreadCountEnvelope> =>
    firstValueFrom(this.#http.get<UnreadCountEnvelope>('/api/notifications/unread-count'));

  markRead = (id: string): Promise<NotificationEnvelope> =>
    firstValueFrom(
      this.#http.post<NotificationEnvelope>(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        {},
      ),
    );
}
