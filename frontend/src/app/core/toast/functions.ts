import { ERROR_DISMISS_MS, MAX_TOASTS, SUCCESS_DISMISS_MS } from './constants';
import { Toast, ToastSeverity } from './types';

export const dismissDurationMs = (severity: ToastSeverity): number =>
  severity === 'error' ? ERROR_DISMISS_MS : SUCCESS_DISMISS_MS;

export const findCoalescableToast = (
  toasts: readonly Toast[],
  severity: ToastSeverity,
  message: string,
): Toast | undefined => toasts.find((toast) => toast.severity === severity && toast.message === message);

/** Append a toast and drop oldest entries when the stack exceeds the max. */
export const pushToastStack = (toasts: readonly Toast[], toast: Toast): readonly Toast[] => {
  const next = [...toasts, toast];
  return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
};

export const removeToastById = (toasts: readonly Toast[], id: string): readonly Toast[] =>
  toasts.filter((toast) => toast.id !== id);

export const toastIdsDroppedOnPush = (
  toasts: readonly Toast[],
  toast: Toast,
): readonly string[] => {
  if (toasts.length < MAX_TOASTS) return [];
  const overflow = toasts.length + 1 - MAX_TOASTS;
  return toasts.slice(0, overflow).map((item) => item.id);
};
