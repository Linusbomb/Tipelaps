import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const decoded = verifyToken(authHeader.substring(7))
  return decoded?.userId ?? null
}

/** Antal tilldelade aktiva projekt som personalen inte godkänt än (“Öppna & godkänn”). */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

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
