import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiCredentialsInterceptor } from './core/http/api-credentials.interceptor';
import { sessionExpiryInterceptor } from './core/http/session-expiry.interceptor';
import { SessionStore } from './core/session/session.store';
import { ThemePreferenceStore } from './core/theme/theme-preference.store';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiCredentialsInterceptor, sessionExpiryInterceptor])),
    provideAppInitializer(() => {
      inject(ThemePreferenceStore);
    }),
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
