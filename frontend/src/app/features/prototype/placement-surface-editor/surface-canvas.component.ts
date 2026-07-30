import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SelectableKind } from './scene.model';

type DragKind = 'move' | 'resize';

/**
 * PROTOTYPE ONLY — schematic SVG canvas: structure behind, slots front;
 * click-to-place tools; select / move / resize rects.
 */
@Component({
  selector: 'app-prototype-surface-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface-canvas.component.html',
  styleUrl: './surface-canvas.component.css',
})
export class SurfaceCanvasComponent {
  readonly store = inject(PrototypeSceneStore);
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');

  private drag:
    | {
        kind: DragKind;
        pointerId: number;
        lastX: number;
        lastY: number;
        originX: number;
        originY: number;
        startW?: number;
        startH?: number;
      }
    | null = null;
  private suppressClick = false;

  onCanvasClick(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.drag) return;
    const tool = this.store.tool();
    if (tool === 'select') {
      this.store.select(null, null);
      return;
    }
    const pt = this.toSvgPoint(event);
    if (!pt) return;
    if (tool === 'slot') this.store.addSlotAt(pt.x, pt.y);
    else if (tool === 'structure-rect') this.store.addStructureRectAt(pt.x, pt.y);
    else if (tool === 'structure-line') this.store.addStructureLineAt(pt.x, pt.y);
  }

  onShapePointerDown(
    event: PointerEvent,
    kind: SelectableKind,
    id: string,
    dragKind: DragKind = 'move',
  ): void {
    event.stopPropagation();
    event.preventDefault();
    this.store.select(kind, id);
    const pt = this.toSvgPoint(event);
    if (!pt) return;
    const surface = this.store.activeSurface();
    let startW: number | undefined;
    let startH: number | undefined;
    if (dragKind === 'resize') {
      if (kind === 'slot') {
        const slot = surface.slots.find((s) => s.id === id);
        if (slot) {
          startW = slot.width;
          startH = slot.height;
        }
      } else if (kind === 'structure-rect') {
        const shape = surface.structures.find((s) => s.id === id);
        if (shape?.kind === 'structure-rect') {
          startW = shape.width;
          startH = shape.height;
        }
      }
    }
    this.drag = {
      kind: dragKind,
      pointerId: event.pointerId,
      lastX: pt.x,
      lastY: pt.y,
      originX: pt.x,
      originY: pt.y,
      startW,
      startH,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const pt = this.toSvgPoint(event);
    if (!pt) return;
    if (this.drag.kind === 'move') {
      this.store.moveSelection(pt.x - this.drag.lastX, pt.y - this.drag.lastY);
      this.drag = { ...this.drag, lastX: pt.x, lastY: pt.y };
    } else if (this.drag.kind === 'resize' && this.drag.startW != null && this.drag.startH != null) {
      this.store.resizeSelectedRect(
        this.drag.startW + (pt.x - this.drag.originX),
        this.drag.startH + (pt.y - this.drag.originY),
      );
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    this.suppressClick = true;
    this.drag = null;
  }

  linePoints(points: { x: number; y: number }[]): string {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

  private toSvgPoint(event: MouseEvent | PointerEvent): { x: number; y: number } | null {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }
}
