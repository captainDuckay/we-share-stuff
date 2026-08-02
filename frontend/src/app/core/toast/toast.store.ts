import { Injectable, signal } from '@angular/core';
import {
  dismissDurationMs,
  findCoalescableToast,
  pushToastStack,
  removeToastById,
  toastIdsDroppedOnPush,
} from './functions';
import { ShowToastOptions, Toast } from './types';

interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout> | undefined;
  remainingMs: number;
  startedAt: number;
  paused: boolean;
}

/**
 * Client-only ephemeral toast queue. Never writes the Notification inbox.
 * Call sites emit toasts; the shell hosts the live region.
 */
@Injectable({ providedIn: 'root' })
export class ToastStore {
  readonly #toasts = signal<readonly Toast[]>([]);
  readonly toasts = this.#toasts.asReadonly();
  readonly #timers = new Map<string, ToastTimer>();
  #nextId = 0;

  success = (message: string): void => {
    this.show({ severity: 'success', message });
  };

  error = (message: string): void => {
    this.show({ severity: 'error', message });
  };

  show = ({ severity, message }: ShowToastOptions): void => {
    const existing = findCoalescableToast(this.#toasts(), severity, message);
    if (existing) {
      this.#restartTimer(existing.id, severity);
      return;
    }

    const id = this.#createId();
    const toast: Toast = { id, severity, message };
    const droppedIds = toastIdsDroppedOnPush(this.#toasts(), toast);
    for (const droppedId of droppedIds) {
      this.#clearTimer(droppedId);
    }
    this.#toasts.update((stack) => pushToastStack(stack, toast));
    this.#startTimer(id, severity);
  };

  dismiss = (id: string): void => {
    this.#clearTimer(id);
    this.#toasts.update((stack) => removeToastById(stack, id));
  };

  /** Pause auto-dismiss (error toasts on hover/focus). No-op when already paused or missing. */
  pause = (id: string): void => {
    const timer = this.#timers.get(id);
    if (!timer || timer.paused || timer.timeoutId === undefined) return;

    clearTimeout(timer.timeoutId);
    const elapsedMs = Date.now() - timer.startedAt;
    timer.remainingMs = Math.max(0, timer.remainingMs - elapsedMs);
    timer.timeoutId = undefined;
    timer.paused = true;
  };

  /** Resume auto-dismiss after pause. */
  resume = (id: string): void => {
    const timer = this.#timers.get(id);
    if (!timer || !timer.paused) return;

    timer.paused = false;
    if (timer.remainingMs <= 0) {
      this.dismiss(id);
      return;
    }
    this.#schedule(id, timer.remainingMs);
  };

  clear = (): void => {
    for (const id of [...this.#timers.keys()]) {
      this.#clearTimer(id);
    }
    this.#toasts.set([]);
  };

  #createId(): string {
    this.#nextId += 1;
    return `toast-${this.#nextId}`;
  }

  #startTimer(id: string, severity: Toast['severity']): void {
    this.#schedule(id, dismissDurationMs(severity));
  }

  #restartTimer(id: string, severity: Toast['severity']): void {
    this.#clearTimer(id);
    this.#startTimer(id, severity);
  }

  #schedule(id: string, remainingMs: number): void {
    const timeoutId = setTimeout(() => this.dismiss(id), remainingMs);
    this.#timers.set(id, {
      timeoutId,
      remainingMs,
      startedAt: Date.now(),
      paused: false,
    });
  }

  #clearTimer(id: string): void {
    const timer = this.#timers.get(id);
    if (timer?.timeoutId !== undefined) {
      clearTimeout(timer.timeoutId);
    }
    this.#timers.delete(id);
  }
}
