import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SurfaceCanvasComponent } from './surface-canvas.component';
import { ToolMode } from './scene.model';

interface ToolDef {
  id: ToolMode;
  label: string;
  icon: string;
  hint: string;
}

/**
 * PROTOTYPE preferred direction after feedback:
 * Surface tabs + Photoshop-style vertical tools *inside* the sketch + infinite zoomable plane.
 * Surface size is derived from content — not authored.
 */
@Component({
  selector: 'app-prototype-variant-d',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MaterialSymbolIconComponent, SurfaceCanvasComponent],
  templateUrl: './variant-d-sketch-tools.component.html',
  styleUrl: './variant-d-sketch-tools.component.css',
})
export class VariantDSketchToolsComponent implements AfterViewInit {
  readonly store = inject(PrototypeSceneStore);
  private readonly canvas = viewChild(SurfaceCanvasComponent);

  readonly tools: ToolDef[] = [
    { id: 'select', label: 'Select', icon: 'arrow-selector-tool', hint: 'Select / move / resize' },
    { id: 'pan', label: 'Pan', icon: 'pan-tool', hint: 'Pan the infinite sketch (or middle-drag)' },
    {
      id: 'structure-rect',
      label: 'Structure box',
      icon: 'crop-square',
      hint: 'Non-linkable structure rectangle',
    },
    {
      id: 'structure-line',
      label: 'Structure line',
      icon: 'horizontal-rule',
      hint: 'Non-linkable shelf / divider line',
    },
    { id: 'slot', label: 'Slot', icon: 'label', hint: 'Labeled Placement Slot' },
  ];

  slotLabelDraft = '';
  slotW = '';
  slotH = '';
  surfaceNameDraft = '';

  constructor() {
    effect(() => {
      // Reset camera when switching surfaces.
      this.store.activeSurfaceId();
      queueMicrotask(() => this.canvas()?.fitContent());
    });
    effect(() => {
      const slot = this.store.selectedSlot();
      this.slotLabelDraft = slot?.label ?? '';
      this.slotW = slot?.widthCm?.toString() ?? '';
      this.slotH = slot?.heightCm?.toString() ?? '';
    });
  }

  ngAfterViewInit(): void {
    this.canvas()?.fitContent();
  }

  onSelectSurface(id: string): void {
    this.store.selectSurface(id);
    this.surfaceNameDraft = this.store.activeSurface().name;
  }

  onAddSurface(): void {
    this.store.addSurface();
    this.surfaceNameDraft = this.store.activeSurface().name;
  }

  applySurfaceName(): void {
    this.store.renameSurface(this.store.activeSurfaceId(), this.surfaceNameDraft);
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

  fit(): void {
    this.canvas()?.fitContent();
  }

  setTool(tool: ToolMode): void {
    this.store.setTool(tool);
  }
}

function parseOptionalCm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}
