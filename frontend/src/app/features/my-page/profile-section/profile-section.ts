import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormField, form, maxLength, submit, validate } from '@angular/forms/signals';
import { ProfileApi } from '../../../core/api/profile-api.service';
import { SessionStore } from '../../../core/session/session.store';
import { ToastStore } from '../../../core/toast/toast.store';
import { UserAvatar } from '../../user-avatar/user-avatar/user-avatar';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PROFILE_PHOTO_ACCEPT,
  profilePhotoInputError,
} from '../functions';

@Component({
  selector: 'app-profile-section',
  imports: [FormField, UserAvatar],
  templateUrl: './profile-section.html',
  styleUrl: './profile-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSection implements OnDestroy {
  readonly #api = inject(ProfileApi);
  readonly #toast = inject(ToastStore);
  readonly session = inject(SessionStore);
  readonly model = signal({ displayName: this.session.user()?.displayName ?? '' });
  readonly profileForm = form(this.model, (path) => {
    validate(path.displayName, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter a Display Name.' },
    );
    maxLength(path.displayName, DISPLAY_NAME_MAX_LENGTH, {
      message: `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    });
  });
  readonly photoAccept = PROFILE_PHOTO_ACCEPT;
  readonly selectedPhoto = signal<File | null>(null);
  readonly selectedPhotoPreviewUrl = signal('');
  readonly saving = signal(false);
  readonly photoBusy = signal(false);
  readonly error = signal('');
  readonly photoError = signal('');
  readonly announcement = signal('');

  ngOnDestroy(): void {
    this.#revokePhotoPreview();
  }

  submitProfile(): void {
    if (this.saving() || this.photoBusy()) return;
    void submit(this.profileForm, async () => this.#saveProfile());
  }

  selectPhoto(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    const validationError = profilePhotoInputError(file);
    this.photoError.set(validationError);
    this.#revokePhotoPreview();
    this.selectedPhoto.set(validationError ? null : file);
    if (file && !validationError) this.selectedPhotoPreviewUrl.set(URL.createObjectURL(file));
  }

  cancelPhotoSelection(): void {
    this.#revokePhotoPreview();
    this.selectedPhoto.set(null);
    this.photoError.set('');
  }

  async uploadPhoto(): Promise<void> {
    const file = this.selectedPhoto();
    if (!file || this.photoBusy() || this.saving()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      const response = await this.#api.uploadPhoto(file);
      this.session.updateUser(response.user);
      this.cancelPhotoSelection();
      this.announcement.set('Profile Photo updated.');
    } catch {
      this.photoError.set('We could not upload that Profile Photo.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  async removePhoto(): Promise<void> {
    if (this.photoBusy() || this.saving()) return;
    this.photoBusy.set(true);
    this.photoError.set('');
    try {
      await this.#api.removePhoto();
      const user = this.session.user();
      if (user) this.session.updateUser({ ...user, profilePhotoUrl: null });
      this.announcement.set('Profile Photo removed.');
    } catch {
      this.photoError.set('We could not remove that Profile Photo.');
    } finally {
      this.photoBusy.set(false);
    }
  }

  async #saveProfile(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const response = await this.#api.update({ displayName: this.model().displayName.trim() });
      this.session.updateUser(response.user);
      this.#toast.success('Profile updated.');
    } catch {
      this.error.set('We could not update your profile.');
      this.#toast.error('We could not update your profile.');
    } finally {
      this.saving.set(false);
    }
  }

  #revokePhotoPreview(): void {
    const url = this.selectedPhotoPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.selectedPhotoPreviewUrl.set('');
  }
}
