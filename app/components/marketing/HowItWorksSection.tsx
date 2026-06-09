import Link from 'next/link'
import { MARKETING_STEPS } from '@/lib/marketingContent'

type HowItWorksSectionProps = {
  variant?: 'preview' | 'full'
}

export default function HowItWorksSection({ variant = 'full' }: HowItWorksSectionProps) {
  const isPreview = variant === 'preview'

  const steps = (
    <ol
      className={
        isPreview
          ? 'mt-8 grid gap-4 md:grid-cols-3'
          : 'relative mt-14 space-y-0 md:space-y-12'
      }
    >
      {MARKETING_STEPS.map((item, index) => (
        <li
          key={item.step}
          className={
            isPreview
              ? 'rounded-xl border border-[#2D5016]/10 bg-white p-5 transition group-hover:border-[#2D5016]/25'
              : 'relative grid gap-6 md:grid-cols-[auto_1fr] md:gap-10'
          }
        >
          {isPreview ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2D5016] text-xs font-bold text-white">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-[#2D5016]">{item.title}</h3>
              <p className="mt-1 text-sm text-[#2D5016]/75">{item.description}</p>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center md:items-start">
                <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#2D5016] text-2xl shadow-lg">
                  {item.icon}
                </div>
                {index < MARKETING_STEPS.length - 1 ? (
                  <div
                    className="hidden h-full w-px bg-[#2D5016]/20 md:block md:min-h-[4rem] md:flex-1"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="rounded-2xl border border-[#2D5016]/10 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#E8F5DC] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#2D5016]">
                    Steg {item.step}
                  </span>
                  <h2 className="text-xl font-bold text-[#2D5016] sm:text-2xl">{item.title}</h2>
                </div>
                <p className="mt-3 text-[#2D5016]/85">{item.description}</p>
                <ul className="mt-5 space-y-2">
                  {item.details.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-[#2D5016]/80">
                      <span className="mt-0.5 text-[#2D5016]" aria-hidden>
                        ✓
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </li>
      ))}
    </ol>
  )

  if (isPreview) {
    return (
      <section className="border-b border-[#2D5016]/10 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/sa-funkar-det"
            className="group block rounded-2xl outline-none transition hover:bg-[#2D5016]/[0.03] focus-visible:ring-2 focus-visible:ring-[#2D5016]/30 -m-4 p-4 sm:-m-6 sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#2D5016] sm:text-3xl">Så funkar det</h2>
                <p className="mt-2 max-w-xl text-[#2D5016]/80">
                  Tre enkla steg från första kontakt till att teamet rapporterar i appen.
                </p>
              </div>
              <span className="inline-flex items-center text-sm font-semibold text-[#2D5016] group-hover:translate-x-1 transition-transform">
                Läs mer →
              </span>
            </div>
            {steps}
          </Link>
        </div>
      </section>
    )
  }

  return steps
}
