import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      employees: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          employmentEndedAt: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      },
      customers: { select: { id: true, name: true } },
      projects: { select: { id: true, name: true } },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  return NextResponse.json(company)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Företagsnamn krävs' }, { status: 400 })
  }

  const existing = await prisma.company.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const updated = await prisma.company.update({
    where: { id: params.id },
    data: { name },
    select: { id: true, name: true, updatedAt: true },
  })

  await logAudit({
    action: 'COMPANY_RENAME',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'Company',
    targetId: updated.id,
    companyId: updated.id,
    details: { from: existing.name, to: updated.name },
    request,
  })

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const userIds = (
      await tx.user.findMany({
        where: { companyId: company.id },
        select: { id: true },
      })
    ).map((u) => u.id)
    if (!userIds.includes(company.ownerId)) userIds.push(company.ownerId)

    let timeReports = 0
    let documents = 0
    let nextOfKin = 0
    let projectEmployees = 0

    if (userIds.length > 0) {
      timeReports = (
        await tx.timeReport.deleteMany({ where: { userId: { in: userIds } } })
      ).count
      documents = (
        await tx.employeeDocument.deleteMany({ where: { userId: { in: userIds } } })
      ).count
      nextOfKin = (await tx.nextOfKin.deleteMany({ where: { userId: { in: userIds } } })).count
      projectEmployees = (
        await tx.projectEmployee.deleteMany({ where: { userId: { in: userIds } } })
      ).count
    }

    await tx.company.delete({ where: { id: company.id } })

    let users = 0
    if (userIds.length > 0) {
      users = (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count
    }
    return { users, timeReports, documents, nextOfKin, projectEmployees }
  })

  await logAudit({
    action: 'COMPANY_DELETE',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'Company',
    targetId: company.id,
    companyId: company.id,
    details: {
      companyName: company.name,
      removed: result,
    },
    request,
  })

  return NextResponse.json({ message: 'Företag och alla relaterade konton borttagna' })
}
