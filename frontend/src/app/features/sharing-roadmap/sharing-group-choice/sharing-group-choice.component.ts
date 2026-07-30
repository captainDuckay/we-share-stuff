import { Component, input, output } from '@angular/core';
import { SharingGroup } from '../../../core/api/model';
import { MaterialSymbolIconComponent } from '../../../ui/material-symbol-icon/material-symbol-icon.component';
import { DEFAULT_SHARING_GROUP_ICON } from '../functions';

@Component({
  selector: 'label[app-sharing-group-choice]',
  imports: [MaterialSymbolIconComponent],
  templateUrl: './sharing-group-choice.component.html',
  styleUrl: '../sharing-page/sharing-page.component.css',
})
export class SharingGroupChoiceComponent {
  readonly defaultSharingGroupIcon = DEFAULT_SHARING_GROUP_ICON;
  readonly group = input.required<SharingGroup>();
  readonly selected = input(false);
  readonly selectedChange = output<boolean>();
}
