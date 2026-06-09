export const EMPLOYEE_DOCUMENT_TYPES = [
  'ID06',
  'DRIVERS_LICENSE',
  'CERTIFICATION',
  'EDUCATION',
  'EMPLOYMENT_CONTRACT',
  'OTHER',
] as const

export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number]

export type EmployeeDocumentDto = {
  id: string
  userId: string
  type: string
  title: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  expiryDate: string | null
  issuedDate: string | null
  description: string | null
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
}

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  ID06: 'ID06',
  DRIVERS_LICENSE: 'Körkort',
  CERTIFICATION: 'Certifiering',
  EDUCATION: 'Utbildningsbevis',
  EMPLOYMENT_CONTRACT: 'Anställningsavtal',
  OTHER: 'Övrigt',
}

export const EMPLOYEE_DOCUMENT_ADD_LABELS: Record<EmployeeDocumentType, string> = {
  ID06: 'Lägg till ID06',
  DRIVERS_LICENSE: 'Lägg till körkort',
  CERTIFICATION: 'Lägg till certifiering',
  EDUCATION: 'Lägg till utbildningsbevis',
  EMPLOYMENT_CONTRACT: 'Lägg till anställningsavtal',
  OTHER: 'Lägg till dokument',
}

export function isEmployeeDocumentType(value: string): value is EmployeeDocumentType {
  return (EMPLOYEE_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export function employeeDocumentTypeLabel(type: string): string {
  if (isEmployeeDocumentType(type)) return EMPLOYEE_DOCUMENT_TYPE_LABELS[type]
  return type
}

export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function documentExpiryStatus(expiryDate: string | null | undefined): 'expired' | 'soon' | 'ok' | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return null
  const now = new Date()
  if (expiry < now) return 'expired'
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  if (expiry <= soon) return 'soon'
  return 'ok'
}

export const EMPLOYEE_DOCUMENT_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,image/*,application/pdf'
