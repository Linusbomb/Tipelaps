// Klientside-hjälpare för att städa upp inloggnings-state i localStorage.
// Hanterar både vanlig session och pågående superadmin-impersonering.

const KEYS_SESSION = ['token', 'user']
const KEYS_IMPERSONATION = ['superadminToken', 'superadminUser', 'impersonatedAs']

export function clearLocalSession(opts: { keepRememberedCredentials?: boolean } = {}) {
  if (typeof window === 'undefined') return
  for (const k of [...KEYS_SESSION, ...KEYS_IMPERSONATION]) {
    localStorage.removeItem(k)
  }
  if (!opts.keepRememberedCredentials) {
    localStorage.removeItem('savedLoginCredentials')
    localStorage.removeItem('rememberLoginDecision')
  }
}

export function clearImpersonationOnly() {
  if (typeof window === 'undefined') return
  for (const k of KEYS_IMPERSONATION) {
    localStorage.removeItem(k)
  }
}

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('impersonatedAs') != null
}
