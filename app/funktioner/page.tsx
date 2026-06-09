import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import { MARKETING_FEATURES } from '@/lib/marketingContent'

export default function FunktionerPage() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#2D5016] sm:text-4xl">Vad TimeLaps gör</h1>
          <p className="mt-4 max-w-2xl text-[#2D5016]/80">
            En komplett portal för företag som vill ha koll på timmar, projekt och team — utan
            krångliga system.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-[#2D5016]/10 bg-white p-6 shadow-sm"
              >
                <div className="text-3xl">{feature.icon}</div>
                <h2 className="mt-4 text-lg font-semibold text-[#2D5016]">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#2D5016]/80">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-12 text-sm text-[#2D5016]/70">
            <Link href="/" className="font-medium underline hover:no-underline">
              ← Tillbaka till startsidan
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  )
}
