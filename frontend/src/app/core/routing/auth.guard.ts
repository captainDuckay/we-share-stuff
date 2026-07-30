import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionStore } from '../session/session.store';

export const authGuard: CanActivateFn = async (_, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  if (store.status() === 'checking') await store.restore();
  return store.status() === 'authenticated'
    ? true
    : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
