'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const minutesTotal = index * 15
  const hours = Math.floor(minutesTotal / 60)
  const minutes = minutesTotal % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

function normalizeClockTime(value: string): string {
  const cleaned = value.trim().replace('.', ':')
  const digits = cleaned.replace(/\D/g, '')

  if (/^\d{1,2}$/.test(digits)) {
    const hours = Number(digits)
    if (hours >= 0 && hours <= 23) return `${String(hours).padStart(2, '0')}:00`
  }

  if (/^\d{3,4}$/.test(digits)) {
    const hoursPart = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2)
    const minutesPart = digits.slice(-2)
    const hours = Number(hoursPart)
    const minutes = Number(minutesPart)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }
  }

  const match = cleaned.match(/^(\d{1,2})(?::?([0-5]\d))?$/)
  if (!match) return cleaned

  const hours = Number(match[1])
  if (hours < 0 || hours > 23) return cleaned
  const minutes = match[2] ?? '00'
  return `${String(hours).padStart(2, '0')}:${minutes}`
}

export default function ClockTimeInput({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const normalizedForFilter = value.trim().replace('.', ':')
  const filteredOptions = useMemo(() => {
    const normalized = normalizeClockTime(normalizedForFilter)
    const filter = normalizedForFilter.replace(/\D/g, '')

    if (!normalizedForFilter) return TIME_OPTIONS
    if (/^\d{1,2}$/.test(filter)) {
      return TIME_OPTIONS.filter((option) => option.startsWith(String(Number(filter)).padStart(2, '0')))
    }
    if (/^\d{3,4}$/.test(filter)) {
      return TIME_OPTIONS.filter((option) => option.startsWith(normalized.slice(0, 4)))
    }
    return TIME_OPTIONS.filter((option) => option.startsWith(normalizedForFilter))
  }, [normalizedForFilter])

  useEffect(() => {
    if (!open || !listRef.current) return

    const normalized = normalizeClockTime(value)
    const index = TIME_OPTIONS.findIndex((option) => option >= normalized)
    const targetIndex = index >= 0 ? index : 0
    listRef.current.scrollTop = Math.max(0, targetIndex * 36 - 72)
  }, [open, value])

  const selectTime = (time: string) => {
    onChange(time)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onBlur={(event) => {
          window.setTimeout(() => setOpen(false), 120)
          onChange(normalizeClockTime(event.target.value))
        }}
        className={className}
        placeholder="HH:mm, t.ex. 16:30"
        pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          {(filteredOptions.length > 0 ? filteredOptions : TIME_OPTIONS).map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => selectTime(time)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-green-50 ${
                value === time ? 'bg-green-100 font-semibold' : ''
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
