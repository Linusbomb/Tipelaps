'use client'

import Link from 'next/link'
import { useId } from 'react'

const brandFont = '"Avenir Next", "Montserrat", "Segoe UI", sans-serif'
const brandColor = '#2D5016'

type TimeLapsLogoProps = {
  href?: string
  className?: string
  variant?: 'corner' | 'hero' | 'mark'
  showWordmark?: boolean
}

function TimeLapsLogoMark({ size }: { size: number }) {
  const uid = useId().replace(/:/g, '')
  const bg = `tl-bg-${uid}`
  const shine = `tl-shine-${uid}`
  const ring = `tl-ring-${uid}`
  const lap = `tl-lap-${uid}`
  const glow = `tl-glow-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className="shrink-0 drop-shadow-md"
      aria-hidden
    >
      <defs>
        <linearGradient id={bg} x1="20" y1="12" x2="108" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4E8F2C" />
          <stop offset="0.45" stopColor="#2D5016" />
          <stop offset="1" stopColor="#1A3310" />
        </linearGradient>
        <radialGradient id={shine} cx="34%" cy="28%" r="55%" fx="34%" fy="28%">
          <stop stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ring} x1="32" y1="32" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8FFD8" />
          <stop offset="1" stopColor="#8BCF62" />
        </linearGradient>
        <linearGradient id={lap} x1="64" y1="24" x2="104" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D4FFAA" />
          <stop offset="1" stopColor="#6FAF3A" />
        </linearGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Skal */}
      <rect x="8" y="8" width="112" height="112" rx="32" fill={`url(#${bg})`} />
      <rect x="8" y="8" width="112" height="112" rx="32" fill={`url(#${shine})`} />

      {/* Yttre lopp-båge */}
      <path
        d="M64 28 A36 36 0 1 1 38 92"
        stroke={`url(#${lap})`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />

      {/* Mellanlopp */}
      <path
        d="M64 36 A28 28 0 1 1 44 84"
        stroke="#C5E89A"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Aktiv tidsbåge */}
      <path
        d="M64 44 A20 20 0 1 1 52 78"
        stroke={`url(#${ring})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${glow})`}
      />

      {/* Klocka — stiliserad T + visare */}
      <circle cx="64" cy="64" r="3.8" fill="#F4FFE8" />
      <path
        d="M64 64 L64 50"
        stroke="#F4FFE8"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M64 64 L76 70"
        stroke="#B8E986"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Framåtpil — tid som rör sig */}
      <path
        d="M88 40 L98 32 M98 32 H86 M98 32 V44"
        stroke="#EEFAD9"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Tick-markeringar */}
      <circle cx="64" cy="46" r="1.6" fill="#EEFAD9" opacity="0.85" />
      <circle cx="82" cy="64" r="1.6" fill="#EEFAD9" opacity="0.65" />
      <circle cx="64" cy="82" r="1.6" fill="#EEFAD9" opacity="0.45" />
    </svg>
  )
}

function TimeLapsWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-wide leading-none ${className}`}
      style={{ fontFamily: brandFont, letterSpacing: '0.04em' }}
    >
      <span style={{ color: brandColor }}>TIME</span>
      <span
        style={{
          background: 'linear-gradient(135deg, #4E8F2C 0%, #2D5016 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        LAPS
      </span>
    </span>
  )
}

function LvtechByline({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-medium tracking-wide text-gray-500 ${className}`}
      style={{ fontFamily: brandFont, letterSpacing: '0.06em' }}
    >
      PART OF LVTECH
    </span>
  )
}

export default function TimeLapsLogo({
  href,
  className = '',
  variant = 'corner',
  showWordmark,
}: TimeLapsLogoProps) {
  const markSize = variant === 'hero' ? 76 : variant === 'mark' ? 36 : 42
  const shouldShowWordmark =
    showWordmark ?? (variant === 'corner' || variant === 'hero')

  const content = (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="TimeLaps">
      <TimeLapsLogoMark size={markSize} />
      {shouldShowWordmark ? (
        <span className="flex flex-col items-start gap-0.5 leading-none">
          <TimeLapsWordmark
            className={variant === 'hero' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}
          />
          <LvtechByline className="text-[9px] sm:text-[10px]" />
        </span>
      ) : null}
    </span>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {content}
      </Link>
    )
  }

  return content
}

export { TimeLapsLogoMark, TimeLapsWordmark, LvtechByline }
