import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ContentBounds,
  SceneSurface,
  SelectableKind,
  Selection,
  ToolMode,
  contentBoundsOf,
} from './scene.model';

type DragKind = 'move' | 'resize' | 'pan' | 'endpoint';

@Component({
  selector: 'app-surface-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface-canvas.html',
  styleUrl: './surface-canvas.css',
})
export class SurfaceCanvas {
  readonly surface = input.required<SceneSurface>();
  readonly tool = input.required<ToolMode>();
  readonly selection = input<Selection | null>(null);

  readonly selectShape = output<{ kind: SelectableKind; id: string } | null>();
  readonly placeAt = output<{ tool: ToolMode; x: number; y: number }>();
  readonly moveDelta = output<{ dx: number; dy: number }>();
  readonly resizeTo = output<{ width: number; height: number }>();
  readonly moveEndpoint = output<{ index: number; x: number; y: number }>();
  readonly interactionEnd = output<void>();

  // Angular forbids ES private on viewChild fields (NG1053).
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('host');

  readonly camX = signal(-40);
  readonly camY = signal(-40);
  readonly camW = signal(900);
  readonly camH = signal(560);

  readonly viewBox = computed(
    () => `${this.camX()} ${this.camY()} ${this.camW()} ${this.camH()}`,
  );

  readonly contentBounds = computed(() => contentBoundsOf(this.surface()));

  readonly contentBoundsLabel = computed(() => {
    const b = this.contentBounds();
    if (!b) return 'Empty sketch — extent grows with structure and slots';
    return `Derived extent ~ ${Math.round(b.width)} × ${Math.round(b.height)} mm (from content)`;
  });

  #drag:
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
        pointIndex?: number;
      }
    | null = null;
  #suppressClick = false;

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const pt = this.#toSvgPoint(event);
    if (!pt) return;
    const factor = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    const nextW = clamp(this.camW() * factor, 80, 20000);
    const nextH = clamp(this.camH() * factor, 50, 14000);
    const rx = (pt.x - this.camX()) / this.camW();
    const ry = (pt.y - this.camY()) / this.camH();
    this.camW.set(nextW);
    this.camH.set(nextH);
    this.camX.set(pt.x - rx * nextW);
    this.camY.set(pt.y - ry * nextH);
  }

  fitContent(): void {
    const b = contentBoundsOf(this.surface());
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
    if (event.button === 1 || this.tool() === 'pan' || event.button === 2) {
      event.preventDefault();
      this.#beginPan(event);
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (this.#suppressClick) {
      this.#suppressClick = false;
      return;
    }
    if (this.#drag) return;
    if (this.tool() === 'pan') return;
    const tool = this.tool();
    if (tool === 'select') {
      this.selectShape.emit(null);
      return;
    }
    const pt = this.#toSvgPoint(event);
    if (!pt) return;
    if (tool === 'slot' || tool === 'structure-rect' || tool === 'structure-line') {
      this.placeAt.emit({ tool, x: pt.x, y: pt.y });
    }
  }

  onShapePointerDown(
    event: PointerEvent,
    kind: SelectableKind,
    id: string,
    dragKind: DragKind = 'move',
    pointIndex?: number,
  ): void {
    if (this.tool() === 'pan' || event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.#beginPan(event);
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.selectShape.emit({ kind, id });
    const pt = this.#toSvgPoint(event);
    if (!pt) return;
    const surface = this.surface();
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
    this.#drag = {
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
      pointIndex,
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    if (this.#drag.kind === 'pan') {
      const scaleX = this.camW() / Math.max(1, this.svgRef()?.nativeElement.clientWidth ?? 1);
      const scaleY = this.camH() / Math.max(1, this.svgRef()?.nativeElement.clientHeight ?? 1);
      const dx = (event.clientX - this.#drag.lastClientX) * scaleX;
      const dy = (event.clientY - this.#drag.lastClientY) * scaleY;
      this.camX.update((x) => x - dx);
      this.camY.update((y) => y - dy);
      this.#drag = {
        ...this.#drag,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      };
      return;
    }

    const pt = this.#toSvgPoint(event);
    if (!pt) return;
    if (this.#drag.kind === 'move') {
      this.moveDelta.emit({
        dx: pt.x - this.#drag.lastWorldX,
        dy: pt.y - this.#drag.lastWorldY,
      });
      this.#drag = { ...this.#drag, lastWorldX: pt.x, lastWorldY: pt.y };
    } else if (this.#drag.kind === 'resize' && this.#drag.startW != null && this.#drag.startH != null) {
      this.resizeTo.emit({
        width: this.#drag.startW + (pt.x - this.#drag.originWorldX),
        height: this.#drag.startH + (pt.y - this.#drag.originWorldY),
      });
    } else if (this.#drag.kind === 'endpoint' && this.#drag.pointIndex != null) {
      this.moveEndpoint.emit({
        index: this.#drag.pointIndex,
        x: pt.x,
        y: pt.y,
      });
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    const wasEdit =
      this.#drag.kind === 'move' ||
      this.#drag.kind === 'resize' ||
      this.#drag.kind === 'endpoint';
    this.#suppressClick = true;
    this.#drag = null;
    if (wasEdit) this.interactionEnd.emit();
  }

  linePoints(points: readonly { x: number; y: number }[]): string {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

  gridPatternId(): string {
    return 'placement-grid';
  }

  boundsPad(bounds: ContentBounds): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: bounds.minX - 12,
      y: bounds.minY - 12,
      width: bounds.width + 24,
      height: bounds.height + 24,
    };
  }

  #beginPan(event: PointerEvent): void {
    this.#drag = {
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

  #toSvgPoint(
    event: MouseEvent | PointerEvent | WheelEvent,
  ): { x: number; y: number } | null {
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
