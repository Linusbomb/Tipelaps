'use client'

import { TimeLapsLogoMark, TimeLapsWordmark, LvtechByline } from '@/app/components/TimeLapsLogo'

const brandFont = '"Avenir Next", "Montserrat", "Segoe UI", sans-serif'
const brandColor = '#2D5016'

type TimeLapsHeroBrandProps = {
  showTagline?: boolean
  taglineClassName?: string
  className?: string
  /** Inuti inloggningskort — utan egen ram/skugga. */
  embedded?: boolean
}

/** TimeLaps-varumärke med logotyp — inloggning (admin/personal) och startsida. */
export default function TimeLapsHeroBrand({
  showTagline = true,
  taglineClassName = 'text-xl sm:text-2xl',
  className = '',
  embedded = false,
}: TimeLapsHeroBrandProps) {
  const brandRow = (
    <div className="inline-flex flex-row items-center gap-4 sm:gap-5">
      <TimeLapsLogoMark size={embedded ? 80 : 72} />
      <div className="flex flex-col items-start gap-0.5 text-left leading-none">
        <h1>
          <TimeLapsWordmark
            className={
              embedded ? 'text-3xl sm:text-4xl' : 'text-3xl sm:text-4xl md:text-5xl'
            }
          />
        </h1>
        <LvtechByline className={embedded ? 'text-[11px] sm:text-xs' : 'text-[10px] sm:text-xs'} />
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className={`text-center ${className}`}>
        {brandRow}
        {showTagline ? (
          <p
            className={`${taglineClassName} mt-4 font-medium tracking-wide`}
            style={{
              color: brandColor,
              fontFamily: brandFont,
              letterSpacing: '0.06em',
            }}
          >
            Tidrapportering ska vara enkelt
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`text-center ${className}`}>
      <div className="relative inline-flex flex-col items-center">
        <div
          className="absolute -inset-4 rounded-[2rem] opacity-40 blur-2xl"
          style={{
            background: 'radial-gradient(circle, #8BCF62 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div
          className="relative inline-flex flex-row items-center gap-4 sm:gap-5 rounded-[1.75rem] border px-6 py-5 sm:px-8 sm:py-6 shadow-lg"
          style={{
            borderColor: 'rgba(45, 80, 22, 0.15)',
            background: 'linear-gradient(160deg, #FFFFFF 0%, #F3FAEE 45%, #E8F5DC 100%)',
            boxShadow: '0 18px 40px -12px rgba(45, 80, 22, 0.25)',
          }}
        >
          <TimeLapsLogoMark size={72} />
          <div className="flex flex-col items-start gap-0.5 text-left leading-none">
            <h1>
              <TimeLapsWordmark className="text-3xl sm:text-4xl md:text-5xl" />
            </h1>
            <LvtechByline className="text-[10px] sm:text-xs" />
          </div>
        </div>
      </div>
      {showTagline && (
        <p
          className={`${taglineClassName} mt-5 font-medium tracking-wide`}
          style={{
            color: brandColor,
            fontFamily: brandFont,
            letterSpacing: '0.06em',
          }}
        >
          Tidrapportering ska vara enkelt
        </p>
      )}
    </div>
  )
}
