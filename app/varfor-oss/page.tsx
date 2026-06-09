import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import WhyChooseUsSection from '@/app/components/marketing/WhyChooseUsSection'
import { MARKETING_WHY_PAGE } from '@/lib/marketingContent'

export default function VarforOssPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-[#2D5016]/10 bg-[#E8F5DC]/30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_#C5E89A50,_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#2D5016]/70">
            Fördelar
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#2D5016] sm:text-4xl lg:text-5xl">
            {MARKETING_WHY_PAGE.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#2D5016]/85">{MARKETING_WHY_PAGE.subtitle}</p>
          <p className="mt-4 max-w-3xl leading-relaxed text-[#2D5016]/75">
            {MARKETING_WHY_PAGE.intro}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <WhyChooseUsSection variant="full" />
        </div>
      </section>

      <section className="border-t border-[#2D5016]/10 bg-[#F8FBF5] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-[#2D5016]">{MARKETING_WHY_PAGE.audienceTitle}</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {MARKETING_WHY_PAGE.audience.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl border border-[#2D5016]/10 bg-white px-4 py-3 text-sm font-medium text-[#2D5016]"
                  >
                    <span className="text-xl" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#2D5016]/15 bg-[#2D5016] p-8 text-[#E8F5DC]">
              <h2 className="text-xl font-bold">{MARKETING_WHY_PAGE.promiseTitle}</h2>
              <p className="mt-4 leading-relaxed text-[#C5E89A]/95">{MARKETING_WHY_PAGE.promise}</p>
              <Link
                href="/kontakt"
                className="mt-6 inline-flex items-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#2D5016] hover:bg-[#E8F5DC]"
              >
                Boka demo →
              </Link>
            </div>
          </div>
          <p className="mt-12 text-center text-sm text-[#2D5016]/70">
            <Link href="/" className="font-medium underline hover:no-underline">
              ← Tillbaka till startsidan
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  )
}
