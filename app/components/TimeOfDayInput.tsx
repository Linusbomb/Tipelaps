'use client'

import { useEffect, useState } from 'react'

type Props = {
  value: string
  onChange: (next: string) => void
  required?: boolean
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

const FULL_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Tidsfält som garanterat är på svenskt 24-timmarsformat (HH:mm).
 * Återger ett vanligt textfält och hanterar automatiskt ":" så användaren bara
 * skriver siffrorna. Slutligt värde skickas till `onChange` antingen som
 * "HH:mm" eller en tom sträng.
 */
export default function TimeOfDayInput({
  value,
  onChange,
  required,
  className,
  ariaLabel,
  disabled,
}: Props) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  const commit = (raw: string) => {
    const digits = raw.replace(/\D+/g, '').slice(0, 4)
    if (digits.length === 0) {
      setDraft('')
      onChange('')
      return
    }

    let hh = ''
    let mm = ''
    if (digits.length <= 2) {
      hh = digits
    } else {
      hh = digits.slice(0, 2)
      mm = digits.slice(2)
    }
    const display = mm.length > 0 ? `${hh}:${mm}` : hh
    setDraft(display)

    if (FULL_RE.test(display)) {
      onChange(display)
    } else {
      onChange('')
    }
  }

  const handleBlur = () => {
    if (draft === '') return
    const digits = draft.replace(/\D+/g, '')
    if (digits.length === 0) return
    const padded = digits.padStart(4, '0').slice(-4)
    const formatted = `${padded.slice(0, 2)}:${padded.slice(2)}`
    if (FULL_RE.test(formatted)) {
      setDraft(formatted)
      onChange(formatted)
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:mm"
      maxLength={5}
      value={draft}
      onChange={(e) => commit(e.target.value)}
      onBlur={handleBlur}
      pattern="^([01]\\d|2[0-3]):[0-5]\\d$"
      title="Ange tid på formatet HH:mm (24-timmars), t.ex. 17:30"
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    />
  )
}
