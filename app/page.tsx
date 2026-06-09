import Link from 'next/link'
import TimeLapsHeroBrand from '@/app/components/TimeLapsHeroBrand'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import HowItWorksSection from '@/app/components/marketing/HowItWorksSection'
import WhyChooseUsSection from '@/app/components/marketing/WhyChooseUsSection'

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-[#2D5016]/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#C5E89A40,_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#2D5016]/80">
                part of LVtech
              </p>
              <h1 className="text-3xl font-bold leading-tight text-[#2D5016] sm:text-4xl lg:text-5xl">
                Tidrapportering som fungerar för entreprenörer och byggteam
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#2D5016]/85">
                TimeLaps samlar timmar, projekt, fordon och personal på ett ställe. Mindre
                administration — mer tid till det som skapar värde.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/sa-funkar-det"
                  className="inline-flex items-center justify-center rounded-lg bg-[#2D5016] px-6 py-3 text-sm font-semibold text-white hover:bg-[#234012]"
                >
                  Så kommer ni igång
                </Link>
                <Link
                  href="/portal"
                  className="inline-flex items-center justify-center rounded-lg border border-[#2D5016]/25 bg-white px-6 py-3 text-sm font-semibold text-[#2D5016] hover:bg-[#2D5016]/5"
                >
                  Befintlig kund? Logga in
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-[#2D5016]/10 bg-white/80 p-8 shadow-lg backdrop-blur-sm">
              <TimeLapsHeroBrand embedded showTagline={false} className="justify-center" />
              <ul className="mt-8 space-y-3 text-sm text-[#2D5016]/90">
                <li className="flex gap-2">
                  <span aria-hidden>✓</span>
                  Daglig tidrapportering för personal
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✓</span>
                  Adminöversikt, godkännande och export
                </li>
                <li className="flex gap-2">
                  <span aria-hidden>✓</span>
                  Projekt, kunder, fordon och nyheter
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSection variant="preview" />
      <WhyChooseUsSection variant="preview" />
    </MarketingShell>
  )
}
