import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { JsonPipe } from '@angular/common';
import { PageLayout } from '../../../layout/page-layout/page-layout';
import { PrototypeSceneStore } from './prototype-scene.store';
import { PrototypeSwitcherComponent, PrototypeVariantMeta } from './prototype-switcher.component';
import { VariantAToolPaletteComponent } from './variant-a-tool-palette.component';
import { VariantBSurfaceCardsComponent } from './variant-b-surface-cards.component';
import { VariantCLabelFirstComponent } from './variant-c-label-first.component';

/**
 * PROTOTYPE ONLY — throwaway route for wayfinder #7.
 * Three variants of owner Placement Surface editor chrome, shared in-memory scene.
 * Plan: "Three variants of the owner surface builder via ?variant= on /prototype/placement-surface-editor."
 */
@Component({
  selector: 'app-placement-surface-editor-prototype-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PrototypeSceneStore],
  imports: [
    PageLayout,
    RouterLink,
    JsonPipe,
    PrototypeSwitcherComponent,
    VariantAToolPaletteComponent,
    VariantBSurfaceCardsComponent,
    VariantCLabelFirstComponent,
  ],
  templateUrl: './placement-surface-editor-prototype.page.html',
  styleUrl: './placement-surface-editor-prototype.page.css',
})
export class PlacementSurfaceEditorPrototypePage {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(PrototypeSceneStore);

  readonly variants: PrototypeVariantMeta[] = [
    { key: 'A', name: 'Tool palette + tabs' },
    { key: 'B', name: 'Surface cards → sketch' },
    { key: 'C', name: 'Label-first inventory' },
  ];

  private readonly queryVariant = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('variant') ?? 'A').toUpperCase())),
    { initialValue: 'A' },
  );

  readonly variant = computed(() => {
    const key = this.queryVariant() ?? 'A';
    return this.variants.some((v) => v.key === key) ? key : 'A';
  });
}
