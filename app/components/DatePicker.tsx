'use client'

import React from 'react'
import ReactDatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import { sv } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// Registrera svenska
registerLocale('sv', sv)

interface ModernDatePickerProps {
  selected: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  required?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
  id?: string
}

export default function ModernDatePicker({
  selected,
  onChange,
  placeholder = 'Välj datum',
  required = false,
  minDate,
  maxDate,
  className = '',
  id,
}: ModernDatePickerProps) {
  return (
    <div className="relative">
      <ReactDatePicker
        id={id}
        selected={selected}
        onChange={onChange}
        dateFormat="yyyy-MM-dd"
        locale="sv"
        placeholderText={placeholder}
        required={required}
        minDate={minDate}
        maxDate={maxDate}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${className}`}
        wrapperClassName="w-full"
        calendarClassName="modern-calendar"
        showPopperArrow={false}
      />
    </div>
  )
}
