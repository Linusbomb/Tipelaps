/** Publika sidor som inloggad superadmin (ej impersonering) inte ska nå. */
export const SUPERADMIN_BLOCKED_PUBLIC_PATHS = [
  '/',
  '/portal',
  '/funktioner',
  '/om-oss',
  '/sa-funkar-det',
  '/varfor-oss',
  '/varfor-valja-oss',
  '/kontakt',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
] as const

export function isSuperadminBlockedPublicPath(pathname: string): boolean {
  const path = (pathname || '/').split('?')[0]
  if (path === '/') return true
  return SUPERADMIN_BLOCKED_PUBLIC_PATHS.some(
    (blocked) => blocked !== '/' && path === blocked
  )
}
