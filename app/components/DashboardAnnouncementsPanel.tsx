'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AnnouncementDetailModal from '@/app/components/AnnouncementDetailModal'
import {
  formatAnnouncementPeriod,
  truncateAnnouncementBody,
  type AnnouncementDto,
} from '@/lib/announcements'

type Props = {
  isAdmin?: boolean
}

export default function DashboardAnnouncementsPanel({ isAdmin = false }: Props) {
  const [items, setItems] = useState<AnnouncementDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AnnouncementDto | null>(null)

  const token = () => localStorage.getItem('token') || ''

  const loadItems = () => {
    const authToken = token()
    if (!authToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/announcements', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems()
  }, [])

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items])

  const markAsRead = async (item: AnnouncementDto) => {
    if (item.isRead) return
    const authToken = token()
    if (!authToken) return

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? { ...entry, isRead: true, readAt: new Date().toISOString() }
          : entry
      )
    )

    try {
      await fetch(`/api/announcements/${item.id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
    } catch {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: false, readAt: null } : entry
        )
      )
    }
  }

  const openAnnouncement = (item: AnnouncementDto) => {
    setSelected(item)
    void markAsRead(item)
  }

  if (loading || items.length === 0) return null

  return (
    <>
      <section
        className="mb-6 overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-amber-50/50 p-4 sm:p-5 shadow-sm"
        aria-label="Nyheter och information"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm"
              aria-hidden
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-sky-950">Nyheter &amp; information</h2>
              {unreadCount > 0 ? (
                <span className="mt-0.5 inline-flex rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {unreadCount} oläst{unreadCount === 1 ? '' : 'a'}
                </span>
              ) : null}
            </div>
          </div>
          {isAdmin ? (
            <Link
              href="/admin/announcements"
              className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
            >
              Hantera nyheter
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-sky-900/70 mb-4 pl-11 sm:pl-0">
          Klicka på en nyhet för att läsa mer. Nyheter visas bara under den period som admin har
          valt.
        </p>
        <div className="space-y-2">
          {items.map((item) => {
            const unread = !item.isRead
            const preview = truncateAnnouncementBody(item.body)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openAnnouncement(item)}
                className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${
                  unread
                    ? 'border-amber-300/80 bg-gradient-to-r from-amber-50 to-white border-l-4 border-l-amber-500 shadow-sm'
                    : 'border-sky-100 bg-white/90 hover:border-sky-200 hover:bg-sky-50/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-start gap-2 min-w-0">
                    {unread ? (
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-200"
                        aria-hidden
                      />
                    ) : null}
                    <h3
                      className={`text-base text-sky-950 ${
                        unread ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {unread ? (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Ny
                      </span>
                    ) : null}
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                      {formatAnnouncementPeriod(item.startsAt, item.endsAt)}
                    </span>
                  </div>
                </div>
                {preview ? (
                  <p className="text-sm text-sky-950/65 line-clamp-2 leading-relaxed">{preview}</p>
                ) : null}
                {item.attachment ? (
                  <p className="mt-1 text-xs text-sky-800/70">
                    📎 Bilaga · {item.attachment.kind === 'IMAGE' ? 'Bild' : 'Dokument'}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-sky-700">Läs mer →</p>
              </button>
            )
          })}
        </div>
      </section>

      <AnnouncementDetailModal
        open={Boolean(selected)}
        item={selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
