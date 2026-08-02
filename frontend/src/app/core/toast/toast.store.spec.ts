import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_DISMISS_MS, MAX_TOASTS, SUCCESS_DISMISS_MS } from './constants';
import { ToastStore } from './toast.store';

const createStore = (): ToastStore => {
  TestBed.configureTestingModule({});
  return TestBed.inject(ToastStore);
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

describe('ToastStore', () => {
  it('enqueues success and error toasts', () => {
    const store = createStore();

    store.success('Saved.');
    store.error('Failed.');

    expect(store.toasts()).toEqual([
      { id: 'toast-1', severity: 'success', message: 'Saved.' },
      { id: 'toast-2', severity: 'error', message: 'Failed.' },
    ]);
  });

  it('supports show with severity', () => {
    const store = createStore();

    store.show({ severity: 'success', message: 'Done.' });
    store.show({ severity: 'warning', message: 'Heads up.' });

    expect(store.toasts().map((toast) => toast.severity)).toEqual(['success', 'warning']);
  });

  it('drops the oldest toast when the stack exceeds the max', () => {
    const store = createStore();

    store.success('One');
    store.success('Two');
    store.success('Three');
    store.success('Four');

    expect(store.toasts()).toHaveLength(MAX_TOASTS);
    expect(store.toasts().map((toast) => toast.message)).toEqual(['Two', 'Three', 'Four']);
  });

  it('coalesces identical severity and message while still in the stack', () => {
    const store = createStore();

    store.success('Same');
    store.error('Other');
    store.success('Same');

    expect(store.toasts()).toHaveLength(2);
    expect(store.toasts().map((toast) => toast.message)).toEqual(['Same', 'Other']);
    expect(store.toasts()[0]?.id).toBe('toast-1');
  });

  it('resets the dismiss timer when coalescing', () => {
    const store = createStore();

    store.success('Same');
    vi.advanceTimersByTime(SUCCESS_DISMISS_MS - 500);
    store.success('Same');
    vi.advanceTimersByTime(SUCCESS_DISMISS_MS - 500);

    expect(store.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(store.toasts()).toHaveLength(0);
  });

  it('auto-dismisses success toasts after about 4 seconds', () => {
    const store = createStore();

    store.success('Saved.');
    vi.advanceTimersByTime(SUCCESS_DISMISS_MS - 1);
    expect(store.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store.toasts()).toHaveLength(0);
  });

  it('auto-dismisses error toasts after about 8 seconds', () => {
    const store = createStore();

    store.error('Failed.');
    vi.advanceTimersByTime(ERROR_DISMISS_MS - 1);
    expect(store.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store.toasts()).toHaveLength(0);
  });

  it('dismisses a toast by id (manual dismiss)', () => {
    const store = createStore();

    store.success('A');
    store.error('B');
    const errorId = store.toasts()[1]!.id;

    store.dismiss(errorId);

    expect(store.toasts().map((toast) => toast.message)).toEqual(['A']);
  });

  it('pauses and resumes error auto-dismiss timers', () => {
    const store = createStore();

    store.error('Failed.');
    const id = store.toasts()[0]!.id;

    vi.advanceTimersByTime(3000);
    store.pause(id);
    vi.advanceTimersByTime(ERROR_DISMISS_MS);
    expect(store.toasts()).toHaveLength(1);

    store.resume(id);
    vi.advanceTimersByTime(ERROR_DISMISS_MS - 3000 - 1);
    expect(store.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store.toasts()).toHaveLength(0);
  });

  it('does not resume a non-paused timer', () => {
    const store = createStore();

    store.error('Failed.');
    const id = store.toasts()[0]!.id;
    store.resume(id);

    vi.advanceTimersByTime(ERROR_DISMISS_MS);
    expect(store.toasts()).toHaveLength(0);
  });

  it('clear removes all toasts and cancels timers', () => {
    const store = createStore();

    store.success('A');
    store.error('B');
    store.clear();

    expect(store.toasts()).toHaveLength(0);
    vi.advanceTimersByTime(ERROR_DISMISS_MS);
    expect(store.toasts()).toHaveLength(0);
  });
});
