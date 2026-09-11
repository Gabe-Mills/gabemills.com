// UI gating is convenience; the Worker and database independently authorize access.
export const canUseAdmin = session => session?.signedIn === true && session?.admin === true;
export const isAdminPath = pathname => pathname === '/support/desk' || pathname.startsWith('/support/desk/');
