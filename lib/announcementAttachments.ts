export const ANNOUNCEMENT_MAX_FILE_BYTES = 10 * 1024 * 1024

export type AnnouncementAttachmentKind = 'IMAGE' | 'DOCUMENT'

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'])

export function classifyAnnouncementMime(mimeType: string): AnnouncementAttachmentKind | null {
  const mime = (mimeType || '').toLowerCase().trim()
  if (IMAGE_MIME_TYPES.has(mime)) return 'IMAGE'
  if (DOCUMENT_MIME_TYPES.has(mime)) return 'DOCUMENT'
  return null
}

export function classifyAnnouncementFile(file: File): AnnouncementAttachmentKind | null {
  const byMime = classifyAnnouncementMime(file.type)
  if (byMime) return byMime

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'IMAGE'
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'DOCUMENT'
  return null
}

export function validateAnnouncementFile(
  file: File
): { ok: true; kind: AnnouncementAttachmentKind } | { ok: false; error: string } {
  if (!file || file.size <= 0) {
    return { ok: false, error: 'Välj en fil att ladda upp.' }
  }
  if (file.size > ANNOUNCEMENT_MAX_FILE_BYTES) {
    return { ok: false, error: 'Filen får vara högst 10 MB.' }
  }
  const kind = classifyAnnouncementFile(file)
  if (!kind) {
    return {
      ok: false,
      error: 'Ogiltig filtyp. Tillåtna format: bild (JPG, PNG, GIF, WebP) eller dokument (PDF, Word, Excel, TXT).',
    }
  }
  return { ok: true, kind }
}

export function sanitizeAnnouncementFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-åäöÅÄÖ\s]/g, '_').replace(/\s+/g, '_').slice(0, 120)
}

export type AnnouncementAttachmentMeta = {
  fileName: string
  mimeType: string
  kind: AnnouncementAttachmentKind
}

export function mapAnnouncementAttachment(record: {
  attachmentFileName?: string | null
  attachmentMimeType?: string | null
  attachmentKind?: string | null
  attachmentStoragePath?: string | null
}): AnnouncementAttachmentMeta | null {
  if (
    !record.attachmentStoragePath ||
    !record.attachmentFileName ||
    !record.attachmentMimeType ||
    !record.attachmentKind
  ) {
    return null
  }
  if (record.attachmentKind !== 'IMAGE' && record.attachmentKind !== 'DOCUMENT') {
    return null
  }
  return {
    fileName: record.attachmentFileName,
    mimeType: record.attachmentMimeType,
    kind: record.attachmentKind,
  }
}

export function announcementAttachmentApiPath(
  announcementId: string,
  options?: { download?: boolean }
): string {
  const base = `/api/announcements/${announcementId}/attachment`
  return options?.download ? `${base}?download=1` : base
}

export type AnnouncementAttachmentDisplay = 'IMAGE' | 'PDF' | 'TEXT' | 'OFFICE' | 'DOCUMENT'

export function getAnnouncementAttachmentDisplay(
  attachment: AnnouncementAttachmentMeta
): AnnouncementAttachmentDisplay {
  if (attachment.kind === 'IMAGE') return 'IMAGE'

  const mime = attachment.mimeType.toLowerCase()
  const ext = attachment.fileName.split('.').pop()?.toLowerCase() || ''

  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF'
  if (mime === 'text/plain' || ext === 'txt') return 'TEXT'
  if (
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    ['doc', 'docx', 'xls', 'xlsx'].includes(ext)
  ) {
    return 'OFFICE'
  }
  return 'DOCUMENT'
}

export function announcementAttachmentTypeLabel(
  display: AnnouncementAttachmentDisplay
): string {
  switch (display) {
    case 'IMAGE':
      return 'Bild'
    case 'PDF':
      return 'PDF'
    case 'TEXT':
      return 'Textfil'
    case 'OFFICE':
      return 'Office-dokument'
    default:
      return 'Dokument'
  }
}
