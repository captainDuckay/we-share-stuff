import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { PrototypeSceneStore } from './prototype-scene.store';
import { SelectableKind, contentBoundsOf } from './scene.model';

type DragKind = 'move' | 'resize' | 'pan';

/**
 * PROTOTYPE ONLY — infinite world plane, camera via viewBox pan/zoom.
 * Surface size is not user-authored; content defines extent.
 */
@Component({
  selector: 'app-prototype-surface-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface-canvas.component.html',
  styleUrl: './surface-canvas.component.css',
})
export class SurfaceCanvasComponent {
  readonly store = inject(PrototypeSceneStore);
  /** When false, host chrome draws tools; canvas is sketch only. */
  readonly embeddedChrome = input(false);

  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('host');

  /** Camera in world units (viewBox). */
  readonly camX = signal(-40);
  readonly camY = signal(-40);
  readonly camW = signal(900);
  readonly camH = signal(560);

  readonly viewBox = computed(
    () => `${this.camX()} ${this.camY()} ${this.camW()} ${this.camH()}`,
  );

  readonly contentBoundsLabel = computed(() => {
    const b = this.store.contentBounds();
    if (!b) return 'Empty sketch — extent grows with structure and slots';
    return `Derived extent ~ ${Math.round(b.width)} × ${Math.round(b.height)} units (from content)`;
  });

  private drag:
    | {
        kind: DragKind;
        pointerId: number;
        lastClientX: number;
        lastClientY: number;
        lastWorldX: number;
        lastWorldY: number;
        originWorldX: number;
        originWorldY: number;
        startW?: number;
        startH?: number;
      }
    | null = null;
  private suppressClick = false;

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const pt = this.toSvgPoint(event);
    if (!pt) return;
    const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    const nextW = clamp(this.camW() * factor, 80, 20000);
    const nextH = clamp(this.camH() * factor, 50, 14000);
    // Keep world point under cursor stable.
    const rx = (pt.x - this.camX()) / this.camW();
    const ry = (pt.y - this.camY()) / this.camH();
    this.camW.set(nextW);
    this.camH.set(nextH);
    this.camX.set(pt.x - rx * nextW);
    this.camY.set(pt.y - ry * nextH);
  }

  fitContent(): void {
    const surface = this.store.activeSurface();
    const b = contentBoundsOf(surface);
    const host = this.hostRef()?.nativeElement;
    const aspect =
      host && host.clientHeight > 0 ? host.clientWidth / host.clientHeight : 900 / 560;
    if (!b) {
      this.camW.set(900);
      this.camH.set(900 / aspect);
      this.camX.set(-100);
      this.camY.set(-100);
      return;
    }
    const pad = 80;
    let w = Math.max(120, b.width + pad * 2);
    let h = Math.max(80, b.height + pad * 2);
    if (w / h > aspect) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    this.camW.set(w);
    this.camH.set(h);
    this.camX.set(b.minX + b.width / 2 - w / 2);
    this.camY.set(b.minY + b.height / 2 - h / 2);
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (event.button === 1 || this.store.tool() === 'pan' || event.button === 2) {
      event.preventDefault();
      this.beginPan(event);
      return;
    }
    if (event.button !== 0) return;
    // empty space handling on pointerup click path
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (this.drag) return;
    if (this.store.tool() === 'pan') return;
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
    if (this.store.tool() === 'pan' || event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.beginPan(event);
      return;
    }
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
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastWorldX: pt.x,
      lastWorldY: pt.y,
      originWorldX: pt.x,
      originWorldY: pt.y,
      startW,
      startH,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (this.drag.kind === 'pan') {
      const scaleX = this.camW() / Math.max(1, this.svgRef()?.nativeElement.clientWidth ?? 1);
      const scaleY = this.camH() / Math.max(1, this.svgRef()?.nativeElement.clientHeight ?? 1);
      const dx = (event.clientX - this.drag.lastClientX) * scaleX;
      const dy = (event.clientY - this.drag.lastClientY) * scaleY;
      this.camX.update((x) => x - dx);
      this.camY.update((y) => y - dy);
      this.drag = {
        ...this.drag,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      };
      return;
    }

    const pt = this.toSvgPoint(event);
    if (!pt) return;
    if (this.drag.kind === 'move') {
      this.store.moveSelection(pt.x - this.drag.lastWorldX, pt.y - this.drag.lastWorldY);
      this.drag = { ...this.drag, lastWorldX: pt.x, lastWorldY: pt.y };
    } else if (this.drag.kind === 'resize' && this.drag.startW != null && this.drag.startH != null) {
      this.store.resizeSelectedRect(
        this.drag.startW + (pt.x - this.drag.originWorldX),
        this.drag.startH + (pt.y - this.drag.originWorldY),
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

  /** Subtle grid that fills current camera. */
  gridPatternId(): string {
    return 'proto-grid';
  }

  private beginPan(event: PointerEvent): void {
    this.drag = {
      kind: 'pan',
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastWorldX: 0,
      lastWorldY: 0,
      originWorldX: 0,
      originWorldY: 0,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  private toSvgPoint(event: MouseEvent | PointerEvent | WheelEvent): { x: number; y: number } | null {
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
