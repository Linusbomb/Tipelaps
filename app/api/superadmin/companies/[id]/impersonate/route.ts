import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateImpersonationToken, requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * Genererar en kortlivad JWT (1 timme) för företagets ägare så superadmin kan
 * logga in i kundens vy. Token markeras som impersonering och innehåller
 * `actingAs` med superadminens identitet för revisionsspårbarhet.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          companyId: true,
          employmentEndedAt: true,
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const owner = company.owner
  if (!owner || owner.employmentEndedAt != null) {
    return NextResponse.json(
      { error: 'Företagets ägare är avslutad och kan inte användas' },
      { status: 400 }
    )
  }

  const token = generateImpersonationToken(owner.id, owner.email, owner.role, {
    id: superAdmin.id,
    email: superAdmin.email,
  })

  await logAudit({
    action: 'IMPERSONATE_START',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'User',
    targetId: owner.id,
    companyId: company.id,
    details: {
      companyName: company.name,
      ownerEmail: owner.email,
      tokenExpiresIn: '1h',
    },
    request,
  })

  return NextResponse.json({
    token,
    expiresInSeconds: 60 * 60,
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
      companyId: owner.companyId,
    },
    company: { id: company.id, name: company.name },
  })
}
