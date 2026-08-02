export const TOAST_SEVERITIES = ['success', 'error', 'warning'] as const;

export type ToastSeverity = (typeof TOAST_SEVERITIES)[number];

export interface Toast {
  readonly id: string;
  readonly severity: ToastSeverity;
  readonly message: string;
}

export interface ShowToastOptions {
  readonly severity: ToastSeverity;
  readonly message: string;
}
