import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Loggar att en superadmin avslutar pågående impersonering. Anropas av
 * ImpersonationBanner när användaren klickar "Återgå". Servern litar inte
 * blint på klienten – vi verifierar att medskickad token är en impersonerings-
 * token och tar `actingAs` därifrån.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Token saknas' }, { status: 401 })
  }
  const decoded = verifyToken(authHeader.substring(7))
  if (!decoded || !decoded.imp || !decoded.actingAs) {
    return NextResponse.json({ error: 'Inte en impersoneringstoken' }, { status: 400 })
  }

  const owner = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, role: true, companyId: true },
  })

  await logAudit({
    action: 'IMPERSONATE_END',
    actor: {
      id: decoded.actingAs.id,
      email: decoded.actingAs.email,
      role: 'SUPERADMIN',
    },
    targetType: 'User',
    targetId: owner?.id ?? decoded.userId,
    companyId: owner?.companyId ?? null,
    details: { ownerEmail: owner?.email ?? decoded.email },
    request,
  })

  return NextResponse.json({ ok: true })
}
