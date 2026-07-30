export const isApiUrl = (url: string): boolean => url === '/api' || url.startsWith('/api/');

export const readXsrfToken = (): string | null =>
  document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.split('=')[1] ?? null;

export const internalReturnUrl = (url: string | null): string =>
  url?.startsWith('/') && !url.startsWith('//') ? url : '/home';
