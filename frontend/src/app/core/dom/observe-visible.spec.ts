import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ObserveVisible } from './observe-visible';

@Component({
  imports: [ObserveVisible],
  template: `<div [app-observe-visible]="true" (visible)="onVisible()" data-testid="host">row</div>`,
})
class HostWithObserve {
  readonly onVisible = vi.fn();
}

describe('ObserveVisible', () => {
  it('emits visible once when IntersectionObserver is unavailable', async () => {
    const original = globalThis.IntersectionObserver;
    // @ts-expect-error force fallback path used in jsdom
    delete globalThis.IntersectionObserver;

    TestBed.configureTestingModule({ imports: [HostWithObserve] });
    const fixture = TestBed.createComponent(HostWithObserve);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.onVisible).toHaveBeenCalledTimes(1);

    if (original) {
      globalThis.IntersectionObserver = original;
    }
  });
});
