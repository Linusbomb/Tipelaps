import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Genererar en JWT för företagets ägare så superadmin kan logga in i kundens vy.
 * Token har samma giltighetstid som vanligt (7 dagar). Klienten ansvarar för att
 * spara superadmins originaltoken så användaren kan återgå.
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

  const token = generateToken(owner.id, owner.email, owner.role)

  return NextResponse.json({
    token,
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
