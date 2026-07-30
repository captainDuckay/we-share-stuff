import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal, viewChild } from '@angular/core';
import {
  FormField,
  email,
  form,
  maxLength,
  minLength,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthApi } from '../../../core/api/auth-api.service';
import { internalReturnUrl, readXsrfToken } from '../../../core/api/functions';
import { Credentials, RegistrationInput } from '../../../core/api/model';
import { SessionStore } from '../../../core/session/session.store';

type Mode = 'register' | 'sign-in';

const DISPLAY_NAME_MAX_LENGTH = 200;
const PASSWORD_MIN_LENGTH = 12;

@Component({
  selector: 'app-auth-page',
  imports: [FormField, RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
})
export class AuthPageComponent {
  readonly mode = input.required<Mode>();
  readonly #api = inject(AuthApi);
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  readonly errorSummary = viewChild<HTMLElement>('errorSummary');
  readonly model = signal({ displayName: '', email: '', password: '' });
  readonly authForm = form(this.model, (path) => {
    validate(path.displayName, ({ value }) =>
      this.mode() === 'register' && !value().trim()
        ? { kind: 'required', message: 'Enter a Display Name.' }
        : undefined,
    );
    maxLength(path.displayName, DISPLAY_NAME_MAX_LENGTH, {
      message: `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    });
    validate(path.email, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: 'Enter an email address.' },
    );
    email(path.email, { message: 'Enter a valid email address.' });
    validate(path.password, ({ value }) =>
      value() ? undefined : { kind: 'required', message: 'Enter a password.' },
    );
    minLength(path.password, PASSWORD_MIN_LENGTH, {
      message: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  });
  readonly pending = signal(false);
  readonly errorMessage = signal('');

  submit(): void {
    if (this.pending()) return;
    void submit(this.authForm, async () => this.#authenticate());
  }

  async #authenticate(): Promise<void> {
    this.pending.set(true);
    this.errorMessage.set('');
    const value = this.model();
    const credentials: Credentials = { email: value.email.trim(), password: value.password };
    try {
      if (!readXsrfToken()) await this.#session.ensureCsrf();
      const response =
        this.mode() === 'register'
          ? await this.#api.register({
              ...credentials,
              displayName: value.displayName.trim(),
            } satisfies RegistrationInput)
          : await this.#api.signIn(credentials);
      this.#session.authenticate(response.user);
      await this.#router.navigateByUrl(
        internalReturnUrl(this.#router.parseUrl(this.#router.url).queryParams['returnUrl'] ?? null),
      );
    } catch (error) {
      this.model.update((model) => ({ ...model, password: '' }));
      this.errorMessage.set(this.#errorMessage(error));
      queueMicrotask(() => this.errorSummary()?.focus());
    } finally {
      this.pending.set(false);
    }
  }

  #errorMessage(error: unknown): string {
    const code =
      error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null
        ? (error.error as { code?: string }).code
        : undefined;
    return code === 'invalid_credentials'
      ? 'Email or password is incorrect.'
      : code === 'registration_failed'
        ? 'We could not create that account.'
        : code === 'rate_limited'
          ? 'Too many attempts. Please try again later.'
          : 'Something went wrong. Please try again.';
  }
}
