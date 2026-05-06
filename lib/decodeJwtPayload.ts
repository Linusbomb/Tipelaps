/**
 * Decodes JWT payload in the browser (base64url + missing padding).
 * Avoids bare atob(segment) which often fails on real JWTs from jsonwebtoken.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    let b64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (b64.length % 4)) % 4
    const padded = padLen === 0 ? b64 : b64 + '='.repeat(padLen)
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}
