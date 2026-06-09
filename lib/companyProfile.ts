export type CompanyProfileInput = {
  organizationNumber?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  contactEmail?: string | null
  phone?: string | null
  information?: string | null
}

const PROFILE_KEYS = [
  'organizationNumber',
  'address',
  'postalCode',
  'city',
  'contactEmail',
  'phone',
  'information',
] as const

export type CompanyProfileKey = (typeof PROFILE_KEYS)[number]

export function bodyHasCompanyProfileFields(body: Record<string, unknown>): boolean {
  return PROFILE_KEYS.some((key) => key in body)
}

export function parseCompanyProfile(
  body: Record<string, unknown>,
  opts?: { partial?: boolean }
): CompanyProfileInput {
  const str = (key: CompanyProfileKey) => {
    if (opts?.partial && !(key in body)) return undefined
    const v = body[key]
    if (typeof v !== 'string') return null
    const trimmed = v.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  const result: CompanyProfileInput = {}
  for (const key of PROFILE_KEYS) {
    const value = key === 'contactEmail' ? str(key)?.toLowerCase() ?? (opts?.partial ? undefined : null) : str(key)
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

export function companyProfileSelectFields() {
  return {
    organizationNumber: true,
    address: true,
    postalCode: true,
    city: true,
    contactEmail: true,
    phone: true,
    information: true,
  } as const
}
