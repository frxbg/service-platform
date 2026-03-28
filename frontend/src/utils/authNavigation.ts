export type LoginRedirectReason = 'logout' | 'timeout' | 'unauthorized';

export const redirectToLogin = (reason?: LoginRedirectReason) => {
    const url = new URL('/login', window.location.origin);
    url.searchParams.set('_ts', String(Date.now()));

    if (reason) {
        url.searchParams.set('reason', reason);
    }

    window.location.replace(`${url.pathname}${url.search}`);
};
