import { NgComponentOutlet } from '@angular/common';
import { Component, Type, effect, input, signal } from '@angular/core';

const DEFAULT_ICON_NAME = 'construction';
const ICON_COMPONENT_PREFIX = 'Msr';
const ICON_COMPONENT_SUFFIX = 'IconComponent';
const EMPTY_ICON_SEGMENT_FALLBACK = '';

type MaterialSymbolsRoundedIconModule =
  typeof import('@captains-chest/material-symbols-rounded-icons');

const toPascalSegment = (segment: string): string =>
  segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : EMPTY_ICON_SEGMENT_FALLBACK;

const iconComponentExportName = (iconName: string): string =>
  `${ICON_COMPONENT_PREFIX}${iconName.split('-').map(toPascalSegment).join('')}${ICON_COMPONENT_SUFFIX}`;

const iconComponentFor = (
  icons: MaterialSymbolsRoundedIconModule,
  iconName: string,
): Type<unknown> | null => {
  const component =
    icons[iconComponentExportName(iconName) as keyof MaterialSymbolsRoundedIconModule];
  return typeof component === 'function' ? (component as Type<unknown>) : null;
};

@Component({
  selector: 'app-material-symbol-icon',
  imports: [NgComponentOutlet],
  templateUrl: './material-symbol-icon.component.html',
  styleUrl: './material-symbol-icon.component.css',
})
export class MaterialSymbolIconComponent {
  readonly name = input(DEFAULT_ICON_NAME);
  readonly component = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      void this.#loadComponent(this.name());
    });
  }

  async #loadComponent(iconName: string): Promise<void> {
    const icons = await import('@captains-chest/material-symbols-rounded-icons');
    this.component.set(
      iconComponentFor(icons, iconName) ?? iconComponentFor(icons, DEFAULT_ICON_NAME),
    );
  }
}
