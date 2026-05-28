const brandFont = '"Avenir Next", "Montserrat", "Segoe UI", sans-serif'
const brandColor = '#2D5016'

type TimeLapsHeroBrandProps = {
  showTagline?: boolean
  titleClassName?: string
  taglineClassName?: string
  className?: string
}

/** TimeLaps-rubrik i samma stil som inloggning (admin/personal). */
export default function TimeLapsHeroBrand({
  showTagline = true,
  titleClassName = 'text-6xl md:text-7xl',
  taglineClassName = 'text-3xl md:text-4xl',
  className = '',
}: TimeLapsHeroBrandProps) {
  return (
    <div className={`text-center ${className}`}>
      <div
        className="inline-flex items-center rounded-xl border px-6 py-2 shadow-sm mb-3"
        style={{
          borderColor: brandColor,
          background: 'linear-gradient(135deg, #F8FBF5 0%, #EEF6E8 100%)',
        }}
      >
        <h1
          className={`${titleClassName} font-semibold leading-none tracking-wide`}
          style={{
            color: brandColor,
            fontFamily: brandFont,
            letterSpacing: '0.03em',
          }}
        >
          TimeLaps
        </h1>
      </div>
      {showTagline && (
        <p
          className={`${taglineClassName} mt-1 font-medium tracking-wide`}
          style={{
            color: brandColor,
            fontFamily: brandFont,
            letterSpacing: '0.02em',
          }}
        >
          Tidrapportering ska vara enkelt
        </p>
      )}
    </div>
  )
}
