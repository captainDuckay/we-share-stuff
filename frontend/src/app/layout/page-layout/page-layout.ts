import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MaterialSymbolIconComponent } from '../../ui/material-symbol-icon/material-symbol-icon.component';

@Component({
  selector: 'app-page-layout',
  imports: [MaterialSymbolIconComponent, RouterLink],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.css',
})
export class PageLayout {
  readonly pageTitle = input.required<string>();
  readonly description = input('');
  readonly backLink = input('');
  readonly backLabel = input('');
  readonly asideLabel = input('');
}
