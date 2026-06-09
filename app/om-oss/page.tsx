import Link from 'next/link'
import MarketingShell from '@/app/components/marketing/MarketingShell'
import { LVTECH_WEBSITE_URL, MARKETING_ABOUT } from '@/lib/marketingContent'

export default function OmOssPage() {
  return (
    <MarketingShell>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#2D5016] sm:text-4xl">
            {MARKETING_ABOUT.heading}
          </h1>

          <div className="mt-10 space-y-10">
            <div>
              <h2 className="text-xl font-semibold text-[#2D5016]">
                {MARKETING_ABOUT.timelapsHeading}
              </h2>
              <p className="mt-3 leading-relaxed text-[#2D5016]/85">
                {MARKETING_ABOUT.timelapsIntro}
              </p>
              <p className="mt-4 leading-relaxed text-[#2D5016]/85">
                {MARKETING_ABOUT.timelapsBroader}
              </p>
              <p className="mt-4 leading-relaxed text-[#2D5016]/85">
                {MARKETING_ABOUT.timelapsPractical}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#2D5016]">
                {MARKETING_ABOUT.lvtechHeading}
              </h2>
              <p className="mt-3 leading-relaxed text-[#2D5016]/85">
                {MARKETING_ABOUT.lvtechIntro}
              </p>
              <p className="mt-4 leading-relaxed text-[#2D5016]/85">
                {MARKETING_ABOUT.lvtechMore}
              </p>
              {LVTECH_WEBSITE_URL ? (
                <p className="mt-5">
                  <a
                    href={LVTECH_WEBSITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-semibold text-[#2D5016] underline hover:no-underline"
                  >
                    {MARKETING_ABOUT.lvtechLinkLabel} →
                  </a>
                </p>
              ) : null}
            </div>
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
