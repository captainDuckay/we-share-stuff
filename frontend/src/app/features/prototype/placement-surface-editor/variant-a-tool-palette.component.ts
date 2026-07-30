import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SurfaceCanvasComponent } from './surface-canvas.component';
import { ToolMode } from './scene.model';

/**
 * PROTOTYPE variant A — top tool palette + surface tabs (desktop schematic).
 * Question: does a mode-tool builder feel right without CAD weight?
 */
@Component({
  selector: 'app-prototype-variant-a',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SurfaceCanvasComponent],
  templateUrl: './variant-a-tool-palette.component.html',
  styleUrl: './variant-a-tool-palette.component.css',
})
export class VariantAToolPaletteComponent {
  readonly store = inject(PrototypeSceneStore);
  readonly tools: { id: ToolMode; label: string }[] = [
    { id: 'select', label: 'Select' },
    { id: 'structure-rect', label: 'Structure □' },
    { id: 'structure-line', label: 'Structure —' },
    { id: 'slot', label: 'Slot' },
  ];

  surfaceNameDraft = '';
  slotLabelDraft = '';
  surfaceW = '';
  surfaceH = '';
  slotW = '';
  slotH = '';

  onSelectSurface(id: string): void {
    this.store.selectSurface(id);
    this.syncDrafts();
  }

  onAddSurface(): void {
    this.store.addSurface();
    this.syncDrafts();
  }

  applySurfaceName(): void {
    this.store.renameSurface(this.store.activeSurfaceId(), this.surfaceNameDraft);
  }

  applySurfacePhysical(): void {
    this.store.setSurfacePhysical(
      this.store.activeSurfaceId(),
      parseOptionalCm(this.surfaceW),
      parseOptionalCm(this.surfaceH),
    );
  }

  applySlotLabel(): void {
    const slot = this.store.selectedSlot();
    if (!slot) return;
    this.store.updateSlotLabel(slot.id, this.slotLabelDraft);
  }

  applySlotPhysical(): void {
    const slot = this.store.selectedSlot();
    if (!slot) return;
    this.store.updateSlotPhysical(slot.id, parseOptionalCm(this.slotW), parseOptionalCm(this.slotH));
  }

  syncDrafts(): void {
    const surface = this.store.activeSurface();
    this.surfaceNameDraft = surface.name;
    this.surfaceW = surface.physical.widthCm?.toString() ?? '';
    this.surfaceH = surface.physical.heightCm?.toString() ?? '';
    const slot = this.store.selectedSlot();
    this.slotLabelDraft = slot?.label ?? '';
    this.slotW = slot?.widthCm?.toString() ?? '';
    this.slotH = slot?.heightCm?.toString() ?? '';
  }
}

function parseOptionalCm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}
