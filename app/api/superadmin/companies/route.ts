import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: {
        select: {
          employees: true,
          customers: true,
          projects: true,
        },
      },
    },
  })

  const activeCounts = await prisma.user.groupBy({
    by: ['companyId'],
    where: {
      companyId: { in: companies.map((c) => c.id) },
      employmentEndedAt: null,
    },
    _count: { _all: true },
  })
  const activeMap = new Map<string, number>()
  for (const row of activeCounts) {
    if (row.companyId) activeMap.set(row.companyId, row._count._all)
  }

  return NextResponse.json(
    companies.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      owner: c.owner,
      counts: {
        employeesTotal: c._count.employees,
        employeesActive: activeMap.get(c.id) ?? 0,
        customers: c._count.customers,
        projects: c._count.projects,
      },
    }))
  )
}

export async function POST(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : ''
  const adminName = typeof body?.adminName === 'string' ? body.adminName.trim() : ''
  const adminEmail =
    typeof body?.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : ''
  const adminPassword = typeof body?.adminPassword === 'string' ? body.adminPassword : ''
  const adminPhone = typeof body?.adminPhone === 'string' ? body.adminPhone.trim() : ''
  const consentAccepted = body?.consentAccepted === true

  if (!companyName || !adminName || !adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: 'Företagsnamn, adminnamn, e-post och lösenord krävs' },
      { status: 400 }
    )
  }
  if (adminPassword.length < 6) {
    return NextResponse.json({ error: 'Lösenord måste vara minst 6 tecken' }, { status: 400 })
  }
  if (!consentAccepted) {
    return NextResponse.json(
      {
        error:
          'Bekräfta att kunden godkänt integritetspolicy och personuppgiftsbiträdesavtal innan kontot skapas',
      },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existing) {
    return NextResponse.json(
      { error: 'En användare med denna e-post finns redan' },
      { status: 400 }
    )
  }

  const hashed = await hashPassword(adminPassword)

  const result = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashed,
        phone: adminPhone || null,
        role: 'ENTREPRENEUR',
      },
    })
    const company = await tx.company.create({
      data: {
        name: companyName,
        ownerId: owner.id,
      },
    })
    const updatedOwner = await tx.user.update({
      where: { id: owner.id },
      data: { companyId: company.id },
      select: { id: true, name: true, email: true, role: true },
    })
    return { company, owner: updatedOwner }
  })

  await logAudit({
    action: 'COMPANY_CREATE',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'Company',
    targetId: result.company.id,
    companyId: result.company.id,
    details: {
      companyName: result.company.name,
      ownerEmail: result.owner.email,
      consentAccepted: true,
    },
    request,
  })

  return NextResponse.json(
    {
      id: result.company.id,
      name: result.company.name,
      createdAt: result.company.createdAt,
      owner: result.owner,
      counts: { employeesTotal: 1, employeesActive: 1, customers: 0, projects: 0 },
    },
    { status: 201 }
  )
}
