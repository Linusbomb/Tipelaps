'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import {
  AnnouncementAttachmentView,
  AnnouncementPendingFileView,
} from '@/app/components/AnnouncementAttachmentView'
import { validateAnnouncementFile } from '@/lib/announcementAttachments'
import { formatAnnouncementPeriod, type AnnouncementDto } from '@/lib/announcements'

type AudienceUser = {
  id: string
  name: string
  email: string
  role: string
}

type AdminAnnouncement = AnnouncementDto & {
  createdByName?: string
}

export default function AdminAnnouncementsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([])
  const [audience, setAudience] = useState<AudienceUser[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [audienceError, setAudienceError] = useState('')
  const [audienceLoading, setAudienceLoading] = useState(true)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    startsAt: '',
    endsAt: '',
    audienceAll: true,
    recipientIds: [] as string[],
  })

  const token = () => localStorage.getItem('token') || ''

  const selected = useMemo(
    () => announcements.find((item) => item.id === selectedId) ?? null,
    [announcements, selectedId]
  )

  const visibleAnnouncements = useMemo(
    () =>
      announcements.filter((item) => (showArchived ? Boolean(item.archivedAt) : !item.archivedAt)),
    [announcements, showArchived]
  )

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const params = showArchived ? '?includeArchived=true' : ''
      const res = await fetch(`/api/admin/announcements${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Kunde inte hämta nyheter'
        )
      }
      setAnnouncements(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta nyheter')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }

  const loadAudience = async () => {
    setAudienceLoading(true)
    setAudienceError('')
    try {
      const res = await fetch('/api/admin/employees', {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Kunde inte hämta personal'
        )
      }
      setAudience(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setAudience([])
      setAudienceError(err instanceof Error ? err.message : 'Kunde inte hämta personal')
    } finally {
      setAudienceLoading(false)
    }
  }

  const loadData = async () => {
    setError('')
    await Promise.all([loadAnnouncements(), loadAudience()])
  }

  useEffect(() => {
    loadData()
  }, [showArchived])

  const resetForm = () => {
    setForm({
      title: '',
      body: '',
      startsAt: '',
      endsAt: '',
      audienceAll: true,
      recipientIds: [],
    })
    setPendingFile(null)
    setRemoveAttachment(false)
  }

  const selectAnnouncement = (item: AdminAnnouncement) => {
    setCreatingNew(false)
    setSelectedId(item.id)
    setForm({
      title: item.title,
      body: item.body,
      startsAt: item.startsAt || '',
      endsAt: item.endsAt || '',
      audienceAll: item.audienceAll,
      recipientIds: item.recipientIds || [],
    })
    setPendingFile(null)
    setRemoveAttachment(false)
    setMessage('')
    setError('')
  }

  const startCreate = () => {
    setCreatingNew(true)
    setSelectedId(null)
    resetForm()
    setMessage('')
    setError('')
  }

  const toggleRecipient = (userId: string) => {
    setForm((prev) => {
      const exists = prev.recipientIds.includes(userId)
      return {
        ...prev,
        recipientIds: exists
          ? prev.recipientIds.filter((id) => id !== userId)
          : [...prev.recipientIds, userId],
      }
    })
  }

  const syncAttachment = async (announcementId: string) => {
    if (removeAttachment) {
      const res = await fetch(`/api/announcements/${announcementId}/attachment`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort bilaga')
      return
    }
    if (!pendingFile) return
    const validation = validateAnnouncementFile(pendingFile)
    if (!validation.ok) throw new Error(validation.error)

    const body = new FormData()
    body.append('file', pendingFile)
    const res = await fetch(`/api/announcements/${announcementId}/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Kunde inte ladda upp bilaga')
  }

  const onAttachmentSelected = (file: File | null) => {
    if (!file) {
      setPendingFile(null)
      return
    }
    const validation = validateAnnouncementFile(file)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setError('')
    setPendingFile(file)
    setRemoveAttachment(false)
  }

  const saveAnnouncement = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      if (!form.title.trim() || !form.body.trim()) {
        setError('Rubrik och text krävs.')
        return
      }
      if (!form.audienceAll && form.recipientIds.length === 0) {
        setError('Välj minst en person eller alla.')
        return
      }

      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        audienceAll: form.audienceAll,
        recipientIds: form.audienceAll ? [] : form.recipientIds,
      }

      const url = creatingNew
        ? '/api/admin/announcements'
        : `/api/admin/announcements/${selectedId}`
      const method = creatingNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte spara')

      const announcementId = typeof data.id === 'string' ? data.id : selectedId
      if (announcementId && (pendingFile || removeAttachment)) {
        await syncAttachment(announcementId)
      }

      setMessage(creatingNew ? 'Nyhet publicerad.' : 'Nyhet uppdaterad.')
      setPendingFile(null)
      setRemoveAttachment(false)
      await loadData()
      setCreatingNew(false)
      setSelectedId(data.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const archiveAnnouncement = async () => {
    if (!selectedId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/announcements/${selectedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort')
      setMessage('Nyheten är borttagen från dashboarden.')
      setSelectedId(null)
      setCreatingNew(false)
      resetForm()
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta bort')
    } finally {
      setSaving(false)
      setDeleteConfirmOpen(false)
    }
  }

  return (
    <div className="app-shell-wide" style={{ backgroundColor: '#E8E8D8', minHeight: '100vh' }}>
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#2D5016' }}>
              Nyheter
            </h1>
            <p className="text-sm text-gray-600">
              Publicera information till personalen på dashboarden. Välj målgrupp och vilken period
              nyheten ska vara synlig — den visas bara för valda personer mellan start- och
              slutdatum (eller tills vidare om inget datum anges).
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
          >
            Till admin
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchived(false)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    !showArchived
                      ? 'bg-[#2D5016] text-white border-transparent'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  Aktiva
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    showArchived
                      ? 'bg-[#2D5016] text-white border-transparent'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  Arkiverade
                </button>
              </div>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: '#2D5016' }}
              >
                + Ny nyhet
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-gray-600">Laddar nyheter…</p>
            ) : visibleAnnouncements.length === 0 ? (
              <p className="text-sm text-gray-600">Inga nyheter i denna vy.</p>
            ) : (
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md max-h-[32rem] overflow-y-auto">
                {visibleAnnouncements.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectAnnouncement(item)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                        item.id === selectedId ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {item.title}
                        {item.attachment ? (
                          <span className="ml-2 text-xs text-gray-500" title="Har bilaga">
                            📎
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatAnnouncementPeriod(item.startsAt, item.endsAt)}
                        {' · '}
                        {item.audienceAll
                          ? 'Alla'
                          : `${item.recipientNames?.length ?? item.recipientIds?.length ?? 0} personer`}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-gray-50/60">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#2D5016' }}>
              {creatingNew ? 'Skapa nyhet' : selected ? 'Redigera nyhet' : 'Välj eller skapa nyhet'}
            </h2>

            {message ? (
              <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            ) : null}

            {(creatingNew || selected) && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Rubrik *</label>
                  <input
                    type="text"
                    value={form.title}
                    disabled={Boolean(selected?.archivedAt) || saving}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    placeholder="T.ex. Service på hjullastare ABC123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Information *</label>
                  <textarea
                    value={form.body}
                    disabled={Boolean(selected?.archivedAt) || saving}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    rows={5}
                    placeholder="Skriv nyhet eller viktig information till personalen…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Bilaga <span className="font-normal text-gray-500">(valfritt)</span>
                  </label>
                  <p className="text-xs text-gray-600 mb-2">
                    Ladda upp en bild eller ett dokument (PDF, Word, Excel, TXT). Max 10 MB.
                  </p>
                  {pendingFile ? (
                    <div className="mb-3 space-y-2">
                      <AnnouncementPendingFileView file={pendingFile} />
                      <button
                        type="button"
                        className="text-sm text-red-700 underline hover:no-underline"
                        onClick={() => setPendingFile(null)}
                      >
                        Ta bort vald fil
                      </button>
                    </div>
                  ) : selected?.attachment && !removeAttachment ? (
                    <div className="mb-3 space-y-2">
                      <AnnouncementAttachmentView
                        announcementId={selected.id}
                        attachment={selected.attachment}
                      />
                      {!selected.archivedAt && !saving ? (
                        <button
                          type="button"
                          onClick={() => setRemoveAttachment(true)}
                          className="text-sm text-red-700 underline hover:no-underline"
                        >
                          Ta bort bilaga
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {removeAttachment ? (
                    <p className="mb-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      Befintlig bilaga tas bort när du sparar.{' '}
                      <button
                        type="button"
                        className="underline font-medium"
                        onClick={() => setRemoveAttachment(false)}
                      >
                        Ångra
                      </button>
                    </p>
                  ) : null}
                  {!selected?.archivedAt && !saving ? (
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={(e) => onAttachmentSelected(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#EEF6E8] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#2D5016] hover:file:bg-[#E2F0D9]"
                    />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Synlig från <span className="font-normal text-gray-500">(valfritt)</span>
                    </label>
                    <input
                      type="date"
                      value={form.startsAt}
                      disabled={Boolean(selected?.archivedAt) || saving}
                      onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Synlig till <span className="font-normal text-gray-500">(valfritt)</span>
                    </label>
                    <input
                      type="date"
                      value={form.endsAt}
                      disabled={Boolean(selected?.archivedAt) || saving}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Vem ska se nyheten?</label>
                  <div className="flex flex-wrap gap-4 mb-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={form.audienceAll}
                        disabled={Boolean(selected?.archivedAt) || saving}
                        onChange={() =>
                          setForm((f) => ({ ...f, audienceAll: true, recipientIds: [] }))
                        }
                      />
                      Alla i företaget
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={!form.audienceAll}
                        disabled={Boolean(selected?.archivedAt) || saving}
                        onChange={() => setForm((f) => ({ ...f, audienceAll: false }))}
                      />
                      Valda personer
                    </label>
                  </div>
                  {!form.audienceAll ? (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        {form.recipientIds.length > 0
                          ? `${form.recipientIds.length} valda`
                          : 'Välj en eller flera personer'}
                      </p>
                      {audienceLoading ? (
                        <p className="text-sm text-gray-600">Laddar personal…</p>
                      ) : audienceError ? (
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          {audienceError}
                        </p>
                      ) : audience.length === 0 ? (
                        <p className="text-sm text-gray-600">
                          Ingen personal hittades. Lägg till personal under Personal först.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
                          {audience.map((person) => {
                            const checked = form.recipientIds.includes(person.id)
                            return (
                              <button
                                key={person.id}
                                type="button"
                                disabled={Boolean(selected?.archivedAt) || saving}
                                onClick={() => toggleRecipient(person.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                                  checked ? 'bg-green-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    checked
                                      ? 'border-[#2D5016] bg-[#2D5016] text-white'
                                      : 'border-gray-300 bg-white'
                                  }`}
                                  aria-hidden
                                >
                                  {checked ? '✓' : ''}
                                </span>
                                <span>
                                  {person.name}
                                  <span className="text-gray-500"> ({person.email})</span>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {!selected?.archivedAt ? (
                    <button
                      type="button"
                      onClick={saveAnnouncement}
                      disabled={saving}
                      className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: '#2D5016' }}
                    >
                      {saving ? 'Sparar…' : creatingNew ? 'Publicera' : 'Spara ändringar'}
                    </button>
                  ) : null}
                  {selected && !creatingNew && !selected.archivedAt ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      disabled={saving}
                      className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
                    >
                      Ta bort från dashboard
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Ta bort nyhet?"
        message="Nyheten tas bort från dashboarden men sparas som arkiverad."
        confirmLabel="Ta bort"
        onConfirm={archiveAnnouncement}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
