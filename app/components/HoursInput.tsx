'use client'

import { useEffect, useState } from 'react'

type HoursInputProps = {
  value: number | null
  onChange: (value: number | null) => void
  required?: boolean
  className?: string
  placeholder?: string
  /** Om true kan fältet lämnas tomt (null), t.ex. fordonstimmar */
  optional?: boolean
}

function formatDisplay(value: number | null): string {
  if (value == null || value === 0) return ''
  return String(value)
}

function parseHoursInput(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim()
  if (normalized === '' || normalized === '.') return null
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}

export default function HoursInput({
  value,
  onChange,
  required,
  className,
  placeholder,
  optional = false,
}: HoursInputProps) {
  const [text, setText] = useState(() => formatDisplay(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value))
    }
  }, [value, focused])

  const commit = (raw: string) => {
    const parsed = parseHoursInput(raw)
    if (parsed == null) {
      onChange(optional ? null : 0)
    } else {
      onChange(parsed)
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      placeholder={placeholder}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit(text)
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        if (raw === '' || raw === '.') {
          onChange(optional ? null : 0)
          return
        }
        const n = parseFloat(raw)
        if (!Number.isNaN(n)) onChange(n)
      }}
    />
  )
}
