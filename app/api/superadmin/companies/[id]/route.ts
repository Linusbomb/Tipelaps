import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

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
  return NextResponse.json(updated)
}

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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  // Radera relaterad användardata för alla anställda/ägaren innan vi tar bort users.
  // Schema saknar cascade på User->TimeReport/EmployeeDocument/etc, så vi rensar manuellt.
  await prisma.$transaction(async (tx) => {
    const userIds = (
      await tx.user.findMany({
        where: { companyId: company.id },
        select: { id: true },
      })
    ).map((u) => u.id)
    if (!userIds.includes(company.ownerId)) userIds.push(company.ownerId)

    if (userIds.length > 0) {
      await tx.timeReport.deleteMany({ where: { userId: { in: userIds } } })
      await tx.employeeDocument.deleteMany({ where: { userId: { in: userIds } } })
      await tx.nextOfKin.deleteMany({ where: { userId: { in: userIds } } })
      await tx.projectEmployee.deleteMany({ where: { userId: { in: userIds } } })
    }

    // Customer/Project/VacationWeek raderas via cascade när företaget tas bort.
    await tx.company.delete({ where: { id: company.id } })

    // Användare har nullable companyId (set null on delete), så de finns kvar — radera explicit.
    if (userIds.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: userIds } } })
    }
  })

  return NextResponse.json({ message: 'Företag och alla relaterade konton borttagna' })
}
