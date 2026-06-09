import Link from 'next/link'
import { MARKETING_BENEFITS } from '@/lib/marketingContent'

type WhyChooseUsSectionProps = {
  variant?: 'preview' | 'full'
}

export default function WhyChooseUsSection({ variant = 'full' }: WhyChooseUsSectionProps) {
  const isPreview = variant === 'preview'

  const grid = (
    <ul className={`grid gap-4 ${isPreview ? 'mt-8 sm:grid-cols-2' : 'mt-12 gap-6 lg:grid-cols-2'}`}>
      {MARKETING_BENEFITS.map((benefit) => (
        <li
          key={benefit.title}
          className={
            isPreview
              ? 'rounded-xl border border-[#2D5016]/10 bg-white p-5 transition group-hover:border-[#2D5016]/25'
              : 'rounded-2xl border border-[#2D5016]/10 bg-white p-6 shadow-sm sm:p-8'
          }
        >
          <div className="flex items-start gap-4">
            <span
              className={`flex shrink-0 items-center justify-center rounded-xl bg-[#E8F5DC] ${
                isPreview ? 'h-10 w-10 text-xl' : 'h-14 w-14 text-2xl'
              }`}
              aria-hidden
            >
              {benefit.icon}
            </span>
            <div>
              <h3
                className={`font-semibold text-[#2D5016] ${isPreview ? 'text-base' : 'text-lg sm:text-xl'}`}
              >
                {benefit.title}
              </h3>
              <p className={`mt-1 text-[#2D5016]/80 ${isPreview ? 'text-sm' : 'text-sm sm:text-base'}`}>
                {benefit.description}
              </p>
              {!isPreview ? (
                <p className="mt-3 text-sm leading-relaxed text-[#2D5016]/70">{benefit.detail}</p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )

  if (isPreview) {
    return (
      <section className="border-b border-[#2D5016]/10 bg-[#E8F5DC]/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/varfor-oss"
            className="group block rounded-2xl outline-none transition hover:bg-[#2D5016]/[0.03] focus-visible:ring-2 focus-visible:ring-[#2D5016]/30 -m-4 p-4 sm:-m-6 sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[#2D5016] sm:text-3xl">
                  Varför ni ska välja oss
                </h2>
                <p className="mt-2 max-w-xl text-[#2D5016]/80">
                  Mindre administration, tryggare underlag och bättre koll på teamet.
                </p>
              </div>
              <span className="inline-flex items-center text-sm font-semibold text-[#2D5016] group-hover:translate-x-1 transition-transform">
                Läs mer →
              </span>
            </div>
            {grid}
          </Link>
        </div>
      </section>
    )
  }

  return grid
}
