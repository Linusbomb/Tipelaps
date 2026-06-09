import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import HowItWorksSection from '@/app/components/marketing/HowItWorksSection'
import { MARKETING_HOW_PAGE } from '@/lib/marketingContent'

export default function SaFunkarDetPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-[#2D5016]/10 bg-[#E8F5DC]/30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_#C5E89A50,_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#2D5016]/70">
            Kom igång
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#2D5016] sm:text-4xl lg:text-5xl">
            {MARKETING_HOW_PAGE.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#2D5016]/85">{MARKETING_HOW_PAGE.subtitle}</p>
          <p className="mt-4 max-w-3xl leading-relaxed text-[#2D5016]/75">
            {MARKETING_HOW_PAGE.intro}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-xl font-bold text-[#2D5016] sm:text-2xl">
            {MARKETING_HOW_PAGE.timelineTitle}
          </h2>
          <HowItWorksSection variant="full" />
        </div>
      </section>

      <section className="border-t border-[#2D5016]/10 bg-[#F8FBF5] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-[#2D5016]">{MARKETING_HOW_PAGE.includesTitle}</h2>
              <ul className="mt-6 space-y-3">
                {MARKETING_HOW_PAGE.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-[#2D5016]/85">
                    <span
                      className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2D5016] text-xs text-white"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#2D5016]/10 bg-white p-8 shadow-sm">
              <p className="text-lg font-semibold text-[#2D5016]">Redo att komma igång?</p>
              <p className="mt-2 text-sm text-[#2D5016]/80">
                Hör av er så berättar vi mer om demo, upplägg och hur TimeLaps kan passa ert team.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/kontakt"
                  className="inline-flex items-center justify-center rounded-lg bg-[#2D5016] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#234012]"
                >
                  Kontakta oss
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg border border-[#2D5016]/20 px-5 py-2.5 text-sm font-semibold text-[#2D5016] hover:bg-[#2D5016]/5"
                >
                  Till startsidan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
