'use client'

import React from 'react'
import ReactDatePicker from 'react-datepicker'
import { registerLocale, setDefaultLocale } from 'react-datepicker'
import { sv } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// Registrera svenska som standard
registerLocale('sv', sv)
setDefaultLocale('sv')

interface MonthPickerProps {
  selected: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  required?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
  id?: string
}

export default function MonthPicker({
  selected,
  onChange,
  placeholder = 'Välj månad',
  required = false,
  minDate,
  maxDate,
  className = '',
  id,
}: MonthPickerProps) {
  return (
    <div className="relative">
      <ReactDatePicker
        id={id}
        selected={selected}
        onChange={onChange}
        dateFormat="MMMM yyyy"
        locale="sv"
        placeholderText={placeholder}
        required={required}
        minDate={minDate}
        maxDate={maxDate}
        showMonthYearPicker
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${className}`}
        wrapperClassName="w-full"
        calendarClassName="modern-month-calendar"
        popperClassName="z-[9999]"
        popperPlacement="bottom-end"
        showPopperArrow={false}
      />
    </div>
  )
}
