export type MarketingContactPayload = {
  companyName: string
  contactName: string
  email: string
  phone?: string
  employeeCount?: string
  message: string
}

export function parseMarketingContactBody(body: unknown): MarketingContactPayload | null {
  if (!body || typeof body !== 'object') return null
  const data = body as Record<string, unknown>
  const companyName = String(data.companyName || '').trim()
  const contactName = String(data.contactName || '').trim()
  const email = String(data.email || '').trim()
  const message = String(data.message || '').trim()
  const phone = String(data.phone || '').trim()
  const employeeCount = String(data.employeeCount || '').trim()

  if (!companyName || !contactName || !email || !message) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  return {
    companyName,
    contactName,
    email,
    message,
    phone: phone || undefined,
    employeeCount: employeeCount || undefined,
  }
}
