'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  announcementAttachmentApiPath,
  announcementAttachmentTypeLabel,
  classifyAnnouncementFile,
  getAnnouncementAttachmentDisplay,
  type AnnouncementAttachmentMeta,
} from '@/lib/announcementAttachments'

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useAnnouncementAttachmentBlobUrl(
  announcementId: string | null | undefined,
  attachment: AnnouncementAttachmentMeta | null | undefined,
  enabled = true
) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !announcementId || !attachment) {
      setUrl(null)
      setLoading(false)
      return undefined
    }

    let objectUrl: string | null = null
    let cancelled = false
    setLoading(true)

    fetch(announcementAttachmentApiPath(announcementId), { headers: authHeaders() })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [announcementId, attachment?.fileName, attachment?.kind, attachment?.mimeType, enabled])

  return { url, loading }
}

function openBlobFile(blob: Blob, fileName: string, mimeType: string, preferDownload: boolean) {
  const typedBlob =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob
      : new Blob([blob], { type: mimeType || 'application/octet-stream' })
  const objectUrl = URL.createObjectURL(typedBlob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.style.display = 'none'
  if (preferDownload) {
    anchor.download = fileName
  } else {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
}

function useAnnouncementAttachmentText(
  announcementId: string | null | undefined,
  attachment: AnnouncementAttachmentMeta | null | undefined,
  enabled: boolean
) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !announcementId || !attachment) {
      setText(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetch(announcementAttachmentApiPath(announcementId), { headers: authHeaders() })
      .then((res) => (res.ok ? res.text() : null))
      .then((value) => {
        if (!cancelled) setText(value)
      })
      .catch(() => {
        if (!cancelled) setText(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [announcementId, attachment?.fileName, enabled])

  return { text, loading }
}

function FileTypeIcon({ display }: { display: ReturnType<typeof getAnnouncementAttachmentDisplay> }) {
  const emoji =
    display === 'PDF'
      ? '📄'
      : display === 'OFFICE'
        ? '📝'
        : display === 'TEXT'
          ? '📃'
          : '📎'

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-xl"
      aria-hidden
    >
      {emoji}
    </span>
  )
}

export function AnnouncementAttachmentView({
  announcementId,
  attachment,
}: {
  announcementId: string
  attachment: AnnouncementAttachmentMeta
}) {
  const display = getAnnouncementAttachmentDisplay(attachment)
  const needsBlobPreview = display === 'IMAGE' || display === 'PDF'
  const { url, loading } = useAnnouncementAttachmentBlobUrl(
    announcementId,
    attachment,
    needsBlobPreview
  )
  const { text, loading: textLoading } = useAnnouncementAttachmentText(
    announcementId,
    attachment,
    display === 'TEXT'
  )
  const [imageExpanded, setImageExpanded] = useState(false)
  const [opening, setOpening] = useState(false)

  const fetchAttachmentBlob = useCallback(async () => {
    const res = await fetch(announcementAttachmentApiPath(announcementId), {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Kunde inte hämta bilagan')
    return res.blob()
  }, [announcementId])

  const download = useCallback(async () => {
    try {
      setOpening(true)
      const blob = await fetchAttachmentBlob()
      openBlobFile(blob, attachment.fileName, attachment.mimeType, true)
    } finally {
      setOpening(false)
    }
  }, [attachment.fileName, attachment.mimeType, fetchAttachmentBlob])

  const openDocument = useCallback(async () => {
    try {
      setOpening(true)
      const blob = await fetchAttachmentBlob()
      openBlobFile(blob, attachment.fileName, attachment.mimeType, display === 'OFFICE' || display === 'DOCUMENT')
    } finally {
      setOpening(false)
    }
  }, [attachment.fileName, attachment.mimeType, display, fetchAttachmentBlob])

  if ((needsBlobPreview && loading) || (display === 'TEXT' && textLoading)) {
    return <p className="text-sm text-gray-600">Laddar bilaga…</p>
  }

  if (display === 'IMAGE' && url) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setImageExpanded(true)}
          className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
          aria-label={`Visa bild i full storlek: ${attachment.fileName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.fileName}
            className="max-h-[min(50vh,20rem)] w-full object-contain"
          />
        </button>
        <p className="text-xs text-gray-500">Tryck på bilden för att förstora.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImageExpanded(true)}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Förstora bild
          </button>
          <button
            type="button"
            disabled={opening}
            onClick={() => void download()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Ladda ner
          </button>
        </div>

        {imageExpanded ? (
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Förstorad bild"
            onClick={() => setImageExpanded(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={attachment.fileName}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setImageExpanded(false)}
              className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-gray-900 shadow"
            >
              Stäng
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (display === 'PDF' && url) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <iframe
            src={url}
            title={attachment.fileName}
            className="h-[min(55vh,28rem)] w-full bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openDocument()}
            disabled={opening}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            Öppna PDF
          </button>
          <button
            type="button"
            disabled={opening}
            onClick={() => void download()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Ladda ner
          </button>
        </div>
      </div>
    )
  }

  if (display === 'TEXT' && text !== null) {
    return (
      <div className="space-y-3">
        <div className="max-h-[min(45vh,18rem)] overflow-auto rounded-xl border border-gray-200 bg-white p-4">
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 font-sans">
            {text}
          </pre>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openDocument()}
            disabled={opening}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            Öppna i ny flik
          </button>
          <button
            type="button"
            disabled={opening}
            onClick={() => void download()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Ladda ner
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white p-4">
        <FileTypeIcon display={display} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 break-words">{attachment.fileName}</p>
          <p className="mt-1 text-xs text-gray-500">
            {announcementAttachmentTypeLabel(display)} · öppnas i Word/Excel eller laddas ner
            beroende på enhet
          </p>
        </div>
      </div>
      <div className="relative z-10 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void openDocument()}
          disabled={opening}
          className="touch-manipulation rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {opening ? 'Öppnar…' : 'Öppna dokument'}
        </button>
        <button
          type="button"
          disabled={opening}
          onClick={() => void download()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          Ladda ner
        </button>
      </div>
    </div>
  )
}

export function AnnouncementPendingFileView({ file }: { file: File }) {
  const kind = classifyAnnouncementFile(file)
  const display = kind
    ? getAnnouncementAttachmentDisplay({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind,
      })
    : 'DOCUMENT'
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const openLocal = () => {
    openBlobFile(file, file.name, file.type, display === 'OFFICE' || display === 'DOCUMENT')
  }

  return (
    <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-green-900">
        Vald fil (sparas vid Spara)
      </p>
      {display === 'IMAGE' && previewUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-48 w-full rounded-lg border border-gray-200 object-contain bg-white"
        />
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white p-4">
          <FileTypeIcon display={display} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 break-words">{file.name}</p>
            <p className="mt-1 text-xs text-gray-500">{announcementAttachmentTypeLabel(display)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openLocal}
          className="touch-manipulation rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
        >
          Öppna fil
        </button>
      </div>
    </div>
  )
}
