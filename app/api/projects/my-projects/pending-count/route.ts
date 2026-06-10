import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { employmentHasEnded } from '@/lib/accountStatus'
import { requireCompanyModuleAccess } from '@/lib/companyModuleAccess'

export const dynamic = 'force-dynamic'

/** Antal tilldelade aktiva projekt som personalen inte godkänt än (“Öppna & godkänn”). */
export async function GET(request: NextRequest) {
  try {
    const access = await requireCompanyModuleAccess(request, 'projects')
    if (!access.ok) return access.response

    const userId = access.user.id

    if (await employmentHasEnded(userId)) {
      return NextResponse.json({ count: 0 })
    }

    const count = await prisma.projectEmployee.count({
      where: {
        userId,
        accepted: false,
        completed: false,
      },
    })

    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Fel vid hämtning av projekt-antal för badge:', error)
    return NextResponse.json({ count: 0 }, { status: 200 })
  }
}
