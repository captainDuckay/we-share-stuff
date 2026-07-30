import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { isApiUrl } from '../api/functions';
import { SessionStore } from '../session/session.store';

const excludedPaths = new Set([
  '/api/auth/session',
  '/api/auth/register',
  '/api/auth/sign-in',
  '/api/auth/sign-out',
]);

export const sessionExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiUrl(request.url) &&
        !excludedPaths.has(request.url) &&
        store.status() === 'authenticated'
      ) {
        store.clear();
        void router.navigate(['/sign-in'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
