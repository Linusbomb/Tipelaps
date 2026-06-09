'use client'

import { useState } from 'react'

export default function MarketingContactForm() {
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    employeeCount: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/marketing/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte skicka')
      setSuccess(data.message || 'Tack! Vi återkommer.')
      setForm({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        employeeCount: '',
        message: '',
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {success ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Företagsnamn *</label>
          <input
            required
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            placeholder="Ert företag AB"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Ditt namn *</label>
          <input
            required
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            placeholder="För- och efternamn"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">E-post *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            placeholder="du@foretag.se"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-800">Telefon</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
            placeholder="070-123 45 67"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">
          Ungefärligt antal anställda
        </label>
        <select
          value={form.employeeCount}
          onChange={(e) => setForm((f) => ({ ...f, employeeCount: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white"
        >
          <option value="">Välj…</option>
          <option value="1-5">1–5</option>
          <option value="6-15">6–15</option>
          <option value="16-50">16–50</option>
          <option value="51+">51+</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">
          Hur kan vi hjälpa er? *
        </label>
        <textarea
          required
          rows={5}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          placeholder="Berätta kort om ert företag och vad ni söker…"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#2D5016] px-4 py-3 text-sm font-semibold text-white hover:bg-[#234012] disabled:opacity-60 sm:w-auto"
      >
        {loading ? 'Skickar…' : 'Skicka förfrågan'}
      </button>
    </form>
  )
}
