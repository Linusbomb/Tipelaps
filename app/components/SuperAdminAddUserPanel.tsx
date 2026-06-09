'use client'

import { useState } from 'react'

const PRIMARY = '#2D5016'

const CATEGORIES = [
  { value: '', label: '— Välj kategori —' },
  { value: 'LASTBILSCHAUFOR', label: 'Lastbilschaufför' },
  { value: 'MASKINFORARE', label: 'Maskinförare' },
  { value: 'MARKANLAGGARE', label: 'Markanläggare' },
  { value: 'TJANSTEMAN', label: 'Tjänsteman' },
]

type CreatedUser = {
  id: string
  name: string
  email: string
  role: string
}

export default function SuperAdminAddUserPanel({
  companyId,
  token,
  onCreated,
}: {
  companyId: string
  token: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'PAYROLL_COORDINATOR',
    employeeCategory: '',
    passwordSetupMethod: 'ADMIN_PASSWORD' as 'ADMIN_PASSWORD' | 'EMAIL_LINK',
    password: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Kunde inte skapa konto')
      }

      const created = data.employee as CreatedUser
      const loginType =
        data.loginHint?.loginType === 'admin' ? 'Admin' : 'Personal'
      let msg = `${created.name} (${created.email}) är skapat.`
      if (form.passwordSetupMethod === 'ADMIN_PASSWORD') {
        msg += ` Inloggning: ${loginType}-rutan med lösenordet du angav.`
      } else {
        msg += ' E-post med lösenordslänk har skickats.'
      }
      setSuccess(msg)
      setForm({
        name: '',
        email: '',
        phone: '',
        role: 'EMPLOYEE',
        employeeCategory: '',
        passwordSetupMethod: 'ADMIN_PASSWORD',
        password: '',
      })
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kunde inte skapa konto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          + Lägg till användare
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:grid-cols-2"
        >
          <label className="text-sm">
            <span className="block text-gray-700">Namn *</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">E-post *</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Telefon</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700">Roll *</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value as 'EMPLOYEE' | 'PAYROLL_COORDINATOR',
                })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="EMPLOYEE">Personal</option>
              <option value="PAYROLL_COORDINATOR">Lönesamordnare (admin)</option>
            </select>
          </label>
          {form.role === 'EMPLOYEE' ? (
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-700">Personalkategori</span>
              <select
                value={form.employeeCategory}
                onChange={(e) => setForm({ ...form, employeeCategory: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value || 'none'} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-700">Lösenordssättning</span>
            <select
              value={form.passwordSetupMethod}
              onChange={(e) =>
                setForm({
                  ...form,
                  passwordSetupMethod: e.target.value as 'ADMIN_PASSWORD' | 'EMAIL_LINK',
                })
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ADMIN_PASSWORD">Superadmin sätter lösenord (rekommenderat)</option>
              <option value="EMAIL_LINK">Skicka inbjudan via e-post</option>
            </select>
          </label>
          {form.passwordSetupMethod === 'ADMIN_PASSWORD' ? (
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-700">Lösenord *</span>
              <input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Minst 6 tecken. Skicka e-post och lösenord säkert till kunden.
              </span>
            </label>
          ) : null}
          {error ? (
            <p className="sm:col-span-2 text-sm text-red-700">{error}</p>
          ) : null}
          {success ? (
            <p className="sm:col-span-2 text-sm text-green-800">{success}</p>
          ) : null}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Stäng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving ? 'Skapar…' : 'Skapa konto'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
