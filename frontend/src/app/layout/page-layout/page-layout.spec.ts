import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { PageLayout } from './page-layout';

@Component({
  imports: [PageLayout],
  template: `
    <app-page-layout
      pageTitle="Browse"
      description="Find Shared Items."
      backLink="/home"
      backLabel="Home"
      asideLabel="Browse filters"
    >
      <p class="test-content">Results</p>
      <div pageAside class="test-aside">Filters</div>
    </app-page-layout>
  `,
})
class TestHost {}

describe('PageLayout', () => {
  it('renders structured page regions and projected content', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TestHost);

    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toContain('Browse');
    expect(element.querySelector('.page-layout__heading p')?.textContent).toContain(
      'Find Shared Items.',
    );
    expect(element.querySelector('.page-layout__content .test-content')?.textContent).toContain(
      'Results',
    );
    expect(element.querySelector('aside')?.getAttribute('aria-label')).toBe('Browse filters');
    expect(element.querySelector('aside .test-aside')?.textContent).toContain('Filters');
    expect(element.querySelector('.page-layout__back-link span')?.textContent).toContain('Home');
  });
});
