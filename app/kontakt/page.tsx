import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import MarketingContactForm from '@/app/components/marketing/MarketingContactForm'

export default function KontaktPage() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <h1 className="text-3xl font-bold text-[#2D5016] sm:text-4xl">
                Kontakta oss som ny kund
              </h1>
              <p className="mt-4 leading-relaxed text-[#2D5016]/85">
                Fyll i formuläret så återkommer vi med mer information, demo eller offert. Redan
                kund? Gå direkt till{' '}
                <Link href="/portal" className="font-semibold underline hover:no-underline">
                  inloggningen
                </Link>
                .
              </p>
              <div className="mt-8 rounded-xl border border-[#2D5016]/10 bg-[#E8F5DC]/50 p-6 text-sm">
                <p className="font-semibold text-[#2D5016]">Befintliga kunder</p>
                <p className="mt-2 text-[#2D5016]/80">
                  Portalen för tidrapportering nås via app-länken från ert företag — eller{' '}
                  <Link href="/portal" className="font-medium underline">
                    logga in här
                  </Link>
                  .
                </p>
              </div>
              <p className="mt-8 text-sm text-[#2D5016]/70">
                <Link href="/" className="font-medium underline hover:no-underline">
                  ← Tillbaka till startsidan
                </Link>
              </p>
            </div>
            <div className="rounded-2xl border border-[#2D5016]/10 bg-white p-6 shadow-sm sm:p-8">
              <MarketingContactForm />
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  )
}
