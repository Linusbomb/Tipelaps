import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateImpersonationToken, isSuperAdminRole, requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Genererar en kortlivad JWT (1 timme) så superadmin kan logga in i kundens vy.
 * Skicka valfritt `{ userId }` i body för att impersonera en specifik användare;
 * utan userId används företagets ägare (admin).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  let body: { userId?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* tom body = impersonera ägare */
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true },
  })

  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const targetUserId =
    typeof body?.userId === 'string' && body.userId.trim() ? body.userId.trim() : company.ownerId

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      employmentEndedAt: true,
    },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 })
  }

  const belongsToCompany =
    targetUser.companyId === company.id || targetUser.id === company.ownerId

  if (!belongsToCompany) {
    return NextResponse.json({ error: 'Användaren tillhör inte detta företag' }, { status: 404 })
  }
  if (targetUser.employmentEndedAt != null) {
    return NextResponse.json(
      { error: 'Användaren är avslutad och kan inte användas för inloggning' },
      { status: 400 }
    )
  }

  if (isSuperAdminRole(targetUser.role)) {
    return NextResponse.json({ error: 'Kan inte impersonera superadmin' }, { status: 400 })
  }

  const token = generateImpersonationToken(targetUser.id, targetUser.email, targetUser.role, {
    id: superAdmin.id,
    email: superAdmin.email,
  })

  await logAudit({
    action: 'IMPERSONATE_START',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'User',
    targetId: targetUser.id,
    companyId: company.id,
    details: {
      companyName: company.name,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      tokenExpiresIn: '1h',
    },
    request,
  })

  return NextResponse.json({
    token,
    expiresInSeconds: 60 * 60,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      companyId: targetUser.companyId,
    },
    company: { id: company.id, name: company.name },
  })
}
