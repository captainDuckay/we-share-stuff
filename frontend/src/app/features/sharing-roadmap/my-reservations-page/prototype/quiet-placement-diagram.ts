import { Component, input } from '@angular/core';
import type { PrototypePlacement } from './fixtures';

/** PROTOTYPE-only quiet schematic — not the production placement diagram. */
@Component({
  selector: 'app-prototype-quiet-placement-diagram',
  template: `
    @if (placement(); as p) {
      @if (p.kind === 'structured') {
        <svg
          class="proto-diagram"
          viewBox="0 0 400 280"
          role="img"
          [attr.aria-label]="'Typical Placement schematic for ' + p.slotLabel"
        >
          @for (block of p.structure; track $index) {
            <rect
              class="proto-diagram__structure"
              [attr.x]="block.x"
              [attr.y]="block.y"
              [attr.width]="block.w"
              [attr.height]="block.h"
            />
          }
          @for (slot of p.otherSlots; track slot.label) {
            <rect
              class="proto-diagram__other"
              [attr.x]="slot.x"
              [attr.y]="slot.y"
              [attr.width]="slot.w"
              [attr.height]="slot.h"
            />
            <text class="proto-diagram__label" [attr.x]="slot.x + 6" [attr.y]="slot.y + 16">
              {{ slot.label }}
            </text>
          }
          <rect
            class="proto-diagram__target"
            [attr.x]="p.slot.x"
            [attr.y]="p.slot.y"
            [attr.width]="p.slot.w"
            [attr.height]="p.slot.h"
          />
          <text class="proto-diagram__label proto-diagram__label--target" [attr.x]="p.slot.x + 6" [attr.y]="p.slot.y + 16">
            {{ p.slotLabel }}
          </text>
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .proto-diagram {
      width: 100%;
      max-width: 20rem;
      height: auto;
      background: var(--muted);
      border-radius: var(--radius-sm);
      border: var(--border-width) solid var(--border);
    }
    .proto-diagram__structure {
      fill: color-mix(in oklch, var(--muted-foreground) 18%, transparent);
      stroke: none;
    }
    .proto-diagram__other {
      fill: color-mix(in oklch, var(--card) 80%, transparent);
      stroke: var(--border);
      stroke-width: 2;
    }
    .proto-diagram__target {
      fill: color-mix(in oklch, var(--primary) 35%, transparent);
      stroke: var(--primary);
      stroke-width: 3;
    }
    .proto-diagram__label {
      fill: var(--muted-foreground);
      font-size: 12px;
    }
    .proto-diagram__label--target {
      fill: var(--foreground);
      font-weight: 600;
    }
  `,
})
export class PrototypeQuietPlacementDiagram {
  readonly placement = input.required<PrototypePlacement>();
}
