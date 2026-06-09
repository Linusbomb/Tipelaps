import MarketingNav from '@/app/components/marketing/MarketingNav'
import MarketingFooter from '@/app/components/marketing/MarketingFooter'

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FBF5] text-[#1A3310]">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  )
}
