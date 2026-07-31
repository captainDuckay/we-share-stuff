import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { StructuredPlacementSnapshot } from '../../../core/api/model';
import { contentBoundsOf } from '../../my-page/placement-surfaces/scene.model';
import {
  contentBoundsPad,
  polylinePointsAttr,
  sceneFromStructuredSnapshot,
} from './functions';

/**
 * Read-only borrower diagram of a frozen structured placement snapshot.
 * Interaction is limited to pan, zoom, and fit — no selection or draw tools.
 */
@Component({
  selector: 'app-placement-snapshot-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './placement-snapshot-diagram.html',
  styleUrl: './placement-snapshot-diagram.css',
})
export class PlacementSnapshotDiagram implements AfterViewInit {
  readonly snapshot = input.required<StructuredPlacementSnapshot>();

  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('host');

  readonly scene = computed(() => sceneFromStructuredSnapshot(this.snapshot()));
  readonly targetSlotId = computed(() => this.snapshot().targetSlot.id);
  readonly contentBounds = computed(() => contentBoundsOf(this.scene()));

  readonly camX = signal(-40);
  readonly camY = signal(-40);
  readonly camW = signal(900);
  readonly camH = signal(560);

  readonly viewBox = computed(
    () => `${this.camX()} ${this.camY()} ${this.camW()} ${this.camH()}`,
  );

  readonly gridPatternId = computed(
    () => `placement-snapshot-grid-${this.snapshot().targetSlot.id}`,
  );

  #drag:
    | {
        pointerId: number;
        lastClientX: number;
        lastClientY: number;
      }
    | null = null;

  constructor() {
    effect(() => {
      // Re-fit when the frozen snapshot identity changes.
      this.snapshot();
      queueMicrotask(() => this.fitSurface());
    });
  }

  ngAfterViewInit(): void {
    this.fitSurface();
  }

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

  fitSurface(): void {
    const b = this.contentBounds();
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

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.#drag = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.#drag || this.#drag.pointerId !== event.pointerId) return;
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return;
    const scaleX = this.camW() / Math.max(1, svg.clientWidth);
    const scaleY = this.camH() / Math.max(1, svg.clientHeight);
    const dx = (event.clientX - this.#drag.lastClientX) * scaleX;
    const dy = (event.clientY - this.#drag.lastClientY) * scaleY;
    this.camX.set(this.camX() - dx);
    this.camY.set(this.camY() - dy);
    this.#drag = {
      ...this.#drag,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
  }

  onPointerUp(event: PointerEvent): void {
    if (this.#drag?.pointerId === event.pointerId) {
      this.#drag = null;
    }
  }

  boundsPad = contentBoundsPad;
  linePoints = polylinePointsAttr;

  #toSvgPoint(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = this.camX() + ((event.clientX - rect.left) / rect.width) * this.camW();
    const y = this.camY() + ((event.clientY - rect.top) / rect.height) * this.camH();
    return { x, y };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
