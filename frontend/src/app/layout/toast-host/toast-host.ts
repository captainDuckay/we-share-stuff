import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastStore } from '../../core/toast/toast.store';
import { ToastSeverity } from '../../core/toast/types';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';

@Component({
  selector: 'aside[app-toast-host]',
  imports: [MaterialSymbolIconComponent],
  templateUrl: './toast-host.html',
  styleUrl: './toast-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'toast-host',
    'aria-live': 'polite',
    'aria-relevant': 'additions',
    'aria-label': 'Status messages',
  },
})
export class ToastHost {
  readonly toastStore = inject(ToastStore);

  dismiss(id: string): void {
    this.toastStore.dismiss(id);
  }

  pause(id: string, severity: ToastSeverity): void {
    if (severity === 'error') this.toastStore.pause(id);
  }

  resume(id: string, severity: ToastSeverity): void {
    if (severity === 'error') this.toastStore.resume(id);
  }
}
