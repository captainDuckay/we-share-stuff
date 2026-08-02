import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { internalReturnUrl } from '../api/functions';
import { SessionStore } from '../session/session.store';

export const guestGuard: CanActivateFn = async (_, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  if (store.status() === 'checking') await store.restore();
  if (store.status() !== 'authenticated') return true;

  const returnUrl = router.parseUrl(state.url).queryParams['returnUrl'];
  return router.parseUrl(
    internalReturnUrl(typeof returnUrl === 'string' ? returnUrl : null),
  );
};
