import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Sant när det inte finns några användare — då får första entreprenören registreras publikt. */
export async function GET() {
  try {
    const count = await prisma.user.count()
    return NextResponse.json({ isFreshDatabase: count === 0 })
  } catch (e) {
    console.error('setup/fresh-database:', e)
    return NextResponse.json({ isFreshDatabase: false, error: 'db_unavailable' }, { status: 503 })
  }
}
