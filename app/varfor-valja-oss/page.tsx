import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import { MARKETING_BENEFITS } from '@/lib/marketingContent'

export default function VarforValjaOssPage() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#2D5016] sm:text-4xl">Varför välja oss?</h1>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {MARKETING_BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-xl border border-[#2D5016]/10 bg-white p-5"
              >
                <p className="font-semibold text-[#2D5016]">{benefit.title}</p>
                <p className="mt-1 text-sm text-[#2D5016]/80">{benefit.description}</p>
              </li>
            ))}
          </ul>
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
