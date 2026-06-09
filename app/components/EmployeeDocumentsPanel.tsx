'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EMPLOYEE_DOCUMENT_ACCEPT,
  EMPLOYEE_DOCUMENT_ADD_LABELS,
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  EMPLOYEE_DOCUMENT_TYPES,
  documentExpiryStatus,
  employeeDocumentTypeLabel,
  formatDocumentDate,
  type EmployeeDocumentDto,
  type EmployeeDocumentType,
} from '@/lib/employeeDocuments'

type UploadFormState = {
  type: EmployeeDocumentType
  title: string
  expiryDate: string
  issuedDate: string
  description: string
  file: File | null
  useCamera: boolean
}

type EditFormState = {
  type: EmployeeDocumentType
  title: string
  expiryDate: string
  issuedDate: string
  description: string
}

const emptyUploadForm = (type: EmployeeDocumentType = 'ID06'): UploadFormState => ({
  type,
  title: '',
  expiryDate: '',
  issuedDate: '',
  description: '',
  file: null,
  useCamera: false,
})

type Props = {
  userId: string
  canManage?: boolean
  title?: string
  description?: string
  onNotify?: (message: { type: 'success' | 'error'; text: string }) => void
}

export default function EmployeeDocumentsPanel({
  userId,
  canManage = true,
  title = 'Mina dokument',
  description = 'Ladda upp ID06, körkort, certifikat och andra dokument. Du kan ta foto eller ladda upp fil.',
  onNotify,
}: Props) {
  const [documents, setDocuments] = useState<EmployeeDocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UploadFormState>(emptyUploadForm())
  const [editForm, setEditForm] = useState<EditFormState>({
    type: 'ID06',
    title: '',
    expiryDate: '',
    issuedDate: '',
    description: '',
  })

  const token = () => localStorage.getItem('token') || ''

  const notify = (type: 'success' | 'error', text: string) => {
    onNotify?.({ type, text })
  }

  const loadDocuments = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents?userId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Kunde inte hämta dokument')
      }
      setDocuments(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Kunde inte hämta dokument')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const documentsByType = useMemo(() => {
    const grouped = new Map<string, EmployeeDocumentDto[]>()
    for (const type of EMPLOYEE_DOCUMENT_TYPES) grouped.set(type, [])
    for (const doc of documents) {
      const bucket = grouped.get(doc.type) ?? grouped.get('OTHER')!
      if (grouped.has(doc.type)) {
        bucket.push(doc)
      } else {
        grouped.get('OTHER')!.push(doc)
      }
    }
    return grouped
  }, [documents])

  const openUpload = (type: EmployeeDocumentType) => {
    setEditingId(null)
    setForm(emptyUploadForm(type))
    setShowUploadForm(true)
  }

  const startEdit = (doc: EmployeeDocumentDto) => {
    setShowUploadForm(false)
    setEditingId(doc.id)
    setEditForm({
      type: (EMPLOYEE_DOCUMENT_TYPES as readonly string[]).includes(doc.type)
        ? (doc.type as EmployeeDocumentType)
        : 'OTHER',
      title: doc.title,
      expiryDate: doc.expiryDate?.slice(0, 10) ?? '',
      issuedDate: doc.issuedDate?.slice(0, 10) ?? '',
      description: doc.description ?? '',
    })
  }

  const uploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.file) {
      notify('error', 'Välj en fil att ladda upp.')
      return
    }
    if (!form.title.trim()) {
      notify('error', 'Ange en titel.')
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', form.file)
      body.append('type', form.type)
      body.append('title', form.title.trim())
      body.append('userId', userId)
      if (form.expiryDate) body.append('expiryDate', form.expiryDate)
      if (form.issuedDate) body.append('issuedDate', form.issuedDate)
      if (form.description.trim()) body.append('description', form.description.trim())

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Kunde inte ladda upp')
      }

      notify('success', 'Dokument uppladdat.')
      setShowUploadForm(false)
      setForm(emptyUploadForm())
      await loadDocuments()
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Kunde inte ladda upp')
    } finally {
      setUploading(false)
    }
  }

  const saveEdit = async (documentId: string) => {
    if (!editForm.title.trim()) {
      notify('error', 'Ange en titel.')
      return
    }
    setSavingEditId(documentId)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: editForm.type,
          title: editForm.title.trim(),
          expiryDate: editForm.expiryDate || null,
          issuedDate: editForm.issuedDate || null,
          description: editForm.description.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Kunde inte spara')
      }
      notify('success', 'Dokument uppdaterat.')
      setEditingId(null)
      await loadDocuments()
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSavingEditId(null)
    }
  }

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta dokument?')) return
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Kunde inte ta bort')
      }
      notify('success', 'Dokument borttaget.')
      if (editingId === documentId) setEditingId(null)
      await loadDocuments()
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Kunde inte ta bort')
    }
  }

  const openDocument = async (doc: EmployeeDocumentDto) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (!res.ok) throw new Error('Kunde inte öppna dokument')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = doc.fileName
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(anchor)
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Kunde inte öppna dokument')
    }
  }

  const renderDocument = (doc: EmployeeDocumentDto) => {
    const expiry = documentExpiryStatus(doc.expiryDate)
    const isEditing = editingId === doc.id

    if (isEditing) {
      return (
        <div key={doc.id} className="rounded-lg border border-[#2D5016]/20 bg-green-50/40 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Typ</label>
              <select
                value={editForm.type}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: e.target.value as EmployeeDocumentType,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                {EMPLOYEE_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Utfärdat</label>
              <input
                type="date"
                value={editForm.issuedDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, issuedDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Förfaller</label>
              <input
                type="date"
                value={editForm.expiryDate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Beskrivning</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Fil: {doc.fileName} (byt fil genom att ta bort och ladda upp igen)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveEdit(doc.id)}
              disabled={savingEditId === doc.id}
              className="rounded-md bg-[#2D5016] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingEditId === doc.id ? 'Sparar…' : 'Spara'}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              Avbryt
            </button>
          </div>
        </div>
      )
    }

    return (
      <div
        key={doc.id}
        className="rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900">{doc.title}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {employeeDocumentTypeLabel(doc.type)} · {doc.fileName} ({(doc.fileSize / 1024).toFixed(1)} KB)
          </p>
          {doc.issuedDate ? (
            <p className="text-xs text-gray-500 mt-1">Utfärdat: {formatDocumentDate(doc.issuedDate)}</p>
          ) : null}
          {doc.expiryDate ? (
            <p
              className={`text-xs mt-1 ${
                expiry === 'expired'
                  ? 'text-red-600 font-semibold'
                  : expiry === 'soon'
                  ? 'text-orange-600 font-medium'
                  : 'text-gray-500'
              }`}
            >
              Förfaller: {formatDocumentDate(doc.expiryDate)}
              {expiry === 'expired' ? ' (förfallet)' : expiry === 'soon' ? ' (förfaller snart)' : ''}
            </p>
          ) : null}
          {doc.description ? <p className="text-sm text-gray-600 mt-2">{doc.description}</p> : null}
          <p className="text-xs text-gray-500 mt-2">
            Uppladdat: {formatDocumentDate(doc.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openDocument(doc)}
            className="rounded-md bg-[#2D5016] px-3 py-2 text-sm font-medium text-white"
          >
            Öppna
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => startEdit(doc)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800"
              >
                Redigera
              </button>
              <button
                type="button"
                onClick={() => deleteDocument(doc.id)}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                Ta bort
              </button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => openUpload('ID06')}
            className="shrink-0 text-sm font-medium text-[#2D5016] hover:underline"
          >
            + Ladda upp dokument
          </button>
        ) : null}
      </div>

      {showUploadForm && canManage ? (
        <form onSubmit={uploadDocument} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <h3 className="font-medium text-gray-900">Nytt dokument</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Typ *</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, type: e.target.value as EmployeeDocumentType }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                {EMPLOYEE_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="T.ex. ID06, Körkort B, Heta arbeten"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Utfärdat</label>
              <input
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm((prev) => ({ ...prev, issuedDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Förfaller</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Beskrivning</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Fil eller foto *</label>
              <input
                type="file"
                accept={EMPLOYEE_DOCUMENT_ACCEPT}
                onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                required={!form.useCamera}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.useCamera}
                  onChange={(e) => setForm((prev) => ({ ...prev, useCamera: e.target.checked }))}
                />
                Ta foto med kameran
              </label>
              {form.useCamera ? (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  required
                />
              ) : null}
              <p className="text-xs text-gray-500 mt-1">PDF, bilder eller Word. Max rekommenderat 10 MB.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-md bg-[#2D5016] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {uploading ? 'Laddar upp…' : 'Ladda upp'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUploadForm(false)
                setForm(emptyUploadForm())
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-800"
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-600">Laddar dokument…</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-500">Inga dokument uppladdade ännu.</p>
      ) : (
        <div className="space-y-5">
          {EMPLOYEE_DOCUMENT_TYPES.map((type) => {
            const items = documentsByType.get(type) ?? []
            if (items.length === 0) return null
            return (
              <section key={type}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {EMPLOYEE_DOCUMENT_TYPE_LABELS[type]}
                  </h3>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => openUpload(type)}
                      className="text-xs font-medium text-[#2D5016] hover:underline"
                    >
                      + {EMPLOYEE_DOCUMENT_ADD_LABELS[type]}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">{items.map(renderDocument)}</div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
