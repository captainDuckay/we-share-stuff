import { HttpInterceptorFn } from '@angular/common/http';
import { isApiUrl, readXsrfToken } from '../api/functions';

const unsafeMethods = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url)) return next(request);
  const token = unsafeMethods.has(request.method) ? readXsrfToken() : null;
  return next(
    request.clone({
      withCredentials: true,
      setHeaders: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
    }),
  );
};
