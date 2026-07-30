import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SurfaceCanvasComponent } from './surface-canvas.component';
import { ToolMode } from './scene.model';

/**
 * PROTOTYPE variant B — surface card list, then full-bleed focused editor.
 * Question: should Surfaces be managed as places first, drawing second?
 */
@Component({
  selector: 'app-prototype-variant-b',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SurfaceCanvasComponent],
  templateUrl: './variant-b-surface-cards.component.html',
  styleUrl: './variant-b-surface-cards.component.css',
})
export class VariantBSurfaceCardsComponent {
  readonly store = inject(PrototypeSceneStore);
  readonly editing = signal(false);
  readonly tools: { id: ToolMode; label: string }[] = [
    { id: 'select', label: 'Move' },
    { id: 'structure-rect', label: 'Cabinet/outline' },
    { id: 'structure-line', label: 'Shelf line' },
    { id: 'slot', label: 'Place slot' },
  ];

  slotLabelDraft = '';

  openEditor(surfaceId: string): void {
    this.store.selectSurface(surfaceId);
    this.editing.set(true);
  }

  closeEditor(): void {
    this.editing.set(false);
    this.store.setTool('select');
  }

  applySlotLabel(): void {
    const slot = this.store.selectedSlot();
    if (!slot) return;
    this.store.updateSlotLabel(slot.id, this.slotLabelDraft);
  }

  onSelectSlotSync(): void {
    this.slotLabelDraft = this.store.selectedSlot()?.label ?? '';
  }
}
