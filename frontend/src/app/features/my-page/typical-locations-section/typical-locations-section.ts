import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TypicalLocationsApi } from '../../../core/api/typical-locations-api.service';
import { ManagedTypicalLocation } from '../../../core/api/model';
import {
  locationFormModel,
  LOCATION_DETAILS_MAX_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  TIMEZONE_MAX_LENGTH,
  typicalLocationInput,
} from '../functions';

@Component({
  selector: 'app-typical-locations-section',
  imports: [FormField, RouterLink],
  templateUrl: './typical-locations-section.html',
  styleUrl: './typical-locations-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypicalLocationsSection {
  readonly #api = inject(TypicalLocationsApi);
  readonly locations = signal<readonly ManagedTypicalLocation[]>([]);
  readonly locationModel = signal(locationFormModel());
  readonly locationForm = form(this.locationModel, (path) => {
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter a location name.' },
    );
    validate(path.timezone, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter an IANA timezone.' },
    );
    maxLength(path.name, LOCATION_NAME_MAX_LENGTH, {
      message: `Use at most ${LOCATION_NAME_MAX_LENGTH} characters.`,
    });
    maxLength(path.details, LOCATION_DETAILS_MAX_LENGTH, {
      message: `Use at most ${LOCATION_DETAILS_MAX_LENGTH} characters.`,
    });
    maxLength(path.timezone, TIMEZONE_MAX_LENGTH, {
      message: `Use at most ${TIMEZONE_MAX_LENGTH} characters.`,
    });
  });
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deletingId = signal('');
  readonly formOpen = signal(false);
  readonly editingId = signal('');
  readonly error = signal('');
  readonly formError = signal('');
  readonly announcement = signal('');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.#api.list();
      this.locations.set(response.typicalLocations);
    } catch {
      this.error.set('We could not load your Typical Locations.');
    } finally {
      this.loading.set(false);
    }
  }

  startCreating(): void {
    if (this.saving()) return;
    this.editingId.set('');
    this.locationModel.set(locationFormModel());
    this.formError.set('');
    this.formOpen.set(true);
  }

  startEditing(location: ManagedTypicalLocation): void {
    if (this.saving()) return;
    this.editingId.set(location.id);
    this.locationModel.set(locationFormModel(location));
    this.formError.set('');
    this.formOpen.set(true);
  }

  cancelEditing(): void {
    this.formOpen.set(false);
    this.editingId.set('');
    this.formError.set('');
  }

  submitLocation(): void {
    if (this.saving()) return;
    void submit(this.locationForm, async () => this.#save());
  }

  async remove(location: ManagedTypicalLocation): Promise<void> {
    if (location.assignedItemCount > 0 || this.deletingId()) return;
    this.deletingId.set(location.id);
    this.error.set('');
    try {
      await this.#api.remove(location.id);
      this.locations.update((locations) => locations.filter(({ id }) => id !== location.id));
      this.announcement.set(`${location.name} deleted.`);
    } catch {
      this.error.set('That Typical Location could not be deleted. Reassign its Items first.');
    } finally {
      this.deletingId.set('');
    }
  }

  async #save(): Promise<void> {
    this.saving.set(true);
    this.formError.set('');
    try {
      const input = typicalLocationInput(this.locationModel());
      const editingId = this.editingId();
      const response = editingId
        ? await this.#api.update(editingId, input)
        : await this.#api.create(input);
      const saved = response.typicalLocation;
      this.locations.update((locations) =>
        editingId
          ? locations.map((location) => (location.id === saved.id ? saved : location))
          : [saved, ...locations],
      );
      this.announcement.set(`${saved.name} saved.`);
      this.cancelEditing();
    } catch {
      this.formError.set('We could not save that Typical Location. Check its timezone.');
    } finally {
      this.saving.set(false);
    }
  }
}
