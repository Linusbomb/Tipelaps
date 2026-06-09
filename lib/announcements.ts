import { formatCalendarDateKey, parseDateOnlyToStorage } from '@/lib/parseDateOnlyLocal'
import { mapAnnouncementAttachment, type AnnouncementAttachmentMeta } from '@/lib/announcementAttachments'

export type AnnouncementDto = {
  id: string
  title: string
  body: string
  startsAt: string | null
  endsAt: string | null
  audienceAll: boolean
  createdAt: string
  recipientIds?: string[]
  recipientNames?: string[]
  archivedAt?: string | null
  isRead?: boolean
  readAt?: string | null
  attachment?: AnnouncementAttachmentMeta | null
}

export function truncateAnnouncementBody(body: string, maxLength = 120): string {
  const trimmed = body.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

export function dateInputToStorage(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  const trimmed = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return parseDateOnlyToStorage(trimmed)
}

export function storageToDateInput(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatCalendarDateKey(date)
}

export function isAnnouncementActiveOnDate(
  announcement: {
    startsAt?: Date | string | null
    endsAt?: Date | string | null
    archivedAt?: Date | string | null
  },
  onDate = new Date()
): boolean {
  if (announcement.archivedAt) return false
  const dayKey = formatCalendarDateKey(onDate)
  if (announcement.startsAt) {
    const startKey = storageToDateInput(announcement.startsAt)
    if (startKey && dayKey < startKey) return false
  }
  if (announcement.endsAt) {
    const endKey = storageToDateInput(announcement.endsAt)
    if (endKey && dayKey > endKey) return false
  }
  return true
}

export function formatAnnouncementPeriod(
  startsAt: string | null,
  endsAt: string | null
): string {
  if (startsAt && endsAt) {
    if (startsAt === endsAt) return `Gäller ${formatSvDate(startsAt)}`
    return `${formatSvDate(startsAt)} – ${formatSvDate(endsAt)}`
  }
  if (startsAt) return `Från ${formatSvDate(startsAt)}`
  if (endsAt) return `Till ${formatSvDate(endsAt)}`
  return 'Tills vidare'
}

function formatSvDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function announcementApiErrorMessage(error: unknown, action: string) {
  const message = error instanceof Error ? error.message : ''
  if (
    message.includes("Cannot read properties of undefined (reading 'create')") ||
    message.includes("Cannot read properties of undefined (reading 'findMany')") ||
    message.includes("Cannot read properties of undefined (reading 'update')")
  ) {
    return 'Nyhetsmodulen är inte laddad. Stoppa dev-servern, kör npx prisma generate och starta om.'
  }
  if (
    (message.includes('CompanyAnnouncement') || message.includes('CompanyAnnouncementRead')) &&
    message.includes('does not exist')
  ) {
    return 'Databasen saknar nyhetstabellen. Kör npx prisma migrate deploy och starta om appen.'
  }
  if (
    message.includes('Unknown argument `attachmentFileName`') ||
    message.includes('Unknown argument `attachmentStoragePath`')
  ) {
    return 'Bilagefälten är inte laddade. Stoppa dev-servern, kör npx prisma generate och starta om (npm run dev).'
  }
  if (message) return `Kunde inte ${action}: ${message}`
  return `Kunde inte ${action}`
}

export function mapAnnouncementRecord(
  record: {
    id: string
    title: string
    body: string
    startsAt: Date | null
    endsAt: Date | null
    audienceAll: boolean
    createdAt: Date
    archivedAt?: Date | null
    attachmentFileName?: string | null
    attachmentStoragePath?: string | null
    attachmentMimeType?: string | null
    attachmentKind?: string | null
    recipients?: Array<{ userId: string; user?: { name: string } | null }>
  },
  options?: { readAt?: Date | null }
): AnnouncementDto {
  const readAt = options?.readAt ?? null
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    startsAt: record.startsAt ? storageToDateInput(record.startsAt) : null,
    endsAt: record.endsAt ? storageToDateInput(record.endsAt) : null,
    audienceAll: record.audienceAll,
    createdAt: record.createdAt.toISOString(),
    archivedAt: record.archivedAt?.toISOString() ?? null,
    recipientIds: record.recipients?.map((item) => item.userId),
    recipientNames: record.recipients?.map((item) => item.user?.name).filter(Boolean) as
      | string[]
      | undefined,
    isRead: Boolean(readAt),
    readAt: readAt?.toISOString() ?? null,
    attachment: mapAnnouncementAttachment(record),
  }
}
