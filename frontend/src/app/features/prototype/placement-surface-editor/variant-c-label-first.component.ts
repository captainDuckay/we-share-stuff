import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SurfaceCanvasComponent } from './surface-canvas.component';

/**
 * PROTOTYPE variant C — label-first inventory: slots as the primary list;
 * canvas is a map preview. Structure is a secondary "outline" mode.
 * Question: should findability labels lead, with geometry as supporting map?
 */
@Component({
  selector: 'app-prototype-variant-c',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SurfaceCanvasComponent],
  templateUrl: './variant-c-label-first.component.html',
  styleUrl: './variant-c-label-first.component.css',
})
export class VariantCLabelFirstComponent {
  readonly store = inject(PrototypeSceneStore);

  readonly allSlots = computed(() => {
    const loc = this.store.location();
    return loc.surfaces.flatMap((surface) =>
      surface.slots.map((slot) => ({
        ...slot,
        surfaceId: surface.id,
        surfaceName: surface.name,
      })),
    );
  });

  newLabel = '';
  surfaceFilter = '';

  selectSlot(surfaceId: string, slotId: string): void {
    if (this.store.activeSurfaceId() !== surfaceId) {
      this.store.selectSurface(surfaceId);
    }
    this.store.select('slot', slotId);
  }

  addLabeledSlot(): void {
    const label = this.newLabel.trim() || 'Slot';
    this.store.setTool('select');
    this.store.addSlotAt(80 + Math.random() * 200, 80 + Math.random() * 120);
    const slot = this.store.selectedSlot();
    if (slot) {
      this.store.updateSlotLabel(slot.id, label);
    }
    this.newLabel = '';
  }

  renameSelected(label: string): void {
    const slot = this.store.selectedSlot();
    if (!slot) return;
    this.store.updateSlotLabel(slot.id, label);
  }

  setOutlineMode(on: boolean): void {
    this.store.setTool(on ? 'structure-rect' : 'select');
  }
}
