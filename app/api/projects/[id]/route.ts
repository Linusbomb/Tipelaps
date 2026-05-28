import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { sendProjectUpdateEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
  if (!user) return null

  const companyId = adminEffectiveCompanyId(user)
  if (!companyId || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  return { user, companyId }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAdminUser(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      address,
      startDate,
      customerId,
      latitude,
      longitude,
      description,
      employeeAssignments,
      notifyEmployees,
    } = body

    if (
      !name ||
      !address ||
      !startDate ||
      !customerId ||
      !Array.isArray(employeeAssignments) ||
      employeeAssignments.length === 0
    ) {
      return NextResponse.json(
        { error: 'Projektnamn, adress, startdatum, kund och minst en anställd krävs' },
        { status: 400 }
      )
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'Välj en exakt plats på kartan för projektet' },
        { status: 400 }
      )
    }

    const invalidAssignment = employeeAssignments.find(
      (item: any) => !item?.employeeId || !item?.equipment || typeof item.equipment !== 'string'
    )
    if (invalidAssignment) {
      return NextResponse.json(
        { error: 'Varje vald anställd måste ha ett tilldelat fordon' },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { employees: true },
    })
    if (!project || project.companyId !== auth.companyId) {
      return NextResponse.json({ error: 'Projekt hittades inte' }, { status: 404 })
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer || customer.companyId !== auth.companyId) {
      return NextResponse.json(
        { error: 'Kunden hittades inte eller tillhör inte ditt företag' },
        { status: 400 }
      )
    }

    const assignedEmployeeIds = employeeAssignments.map((item: any) => item.employeeId)
    const employees = await prisma.user.findMany({
      where: {
        id: { in: assignedEmployeeIds },
        companyId: auth.companyId,
        employmentEndedAt: null,
        role: 'EMPLOYEE',
      },
      select: { id: true, name: true, email: true },
    })
    if (employees.length !== assignedEmployeeIds.length) {
      return NextResponse.json(
        { error: 'En eller flera valda anställda tillhör inte ditt företag eller är avslutade' },
        { status: 400 }
      )
    }

    const incomingByUserId = new Map(
      employeeAssignments.map((item: any) => [item.employeeId, item.equipment.trim()])
    )
    const existingAssignments = project.employees
    const toDelete = existingAssignments.filter((assignment) => !incomingByUserId.has(assignment.userId))
    const toUpdate = existingAssignments.filter((assignment) => incomingByUserId.has(assignment.userId))
    const existingUserIds = new Set(existingAssignments.map((assignment) => assignment.userId))
    const toCreate = employeeAssignments.filter((item: any) => !existingUserIds.has(item.employeeId))

    await prisma.$transaction([
      prisma.project.update({
        where: { id: params.id },
        data: {
          name: String(name).trim(),
          address: String(address).trim(),
          latitude,
          longitude,
          startDate: new Date(startDate),
          customerId,
          description: typeof description === 'string' && description.trim() ? description.trim() : null,
        },
      }),
      ...toDelete.map((assignment) =>
        prisma.projectEmployee.delete({ where: { id: assignment.id } })
      ),
      ...toUpdate.map((assignment) =>
        prisma.projectEmployee.update({
          where: { id: assignment.id },
          data: { assignedEquipment: incomingByUserId.get(assignment.userId) },
        })
      ),
      ...toCreate.map((item: any) =>
        prisma.projectEmployee.create({
          data: {
            projectId: params.id,
            userId: item.employeeId,
            assignedEquipment: item.equipment.trim(),
            accepted: false,
            acceptedAt: null,
          },
        })
      ),
    ])

    const updatedProject = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true } },
        attachments: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        employees: {
          select: {
            id: true,
            userId: true,
            accepted: true,
            acceptedAt: true,
            completed: true,
            completedAt: true,
            assignedEquipment: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    let notificationsSent = 0
    if (notifyEmployees === true && updatedProject) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const projectLink = `${baseUrl.replace(/\/$/, '')}/my-projects?projectId=${encodeURIComponent(params.id)}`
      const recipients = new Map<string, { email: string; name: string }>()
      for (const assignment of updatedProject.employees) {
        if (assignment.user.email) {
          recipients.set(assignment.user.email, {
            email: assignment.user.email,
            name: assignment.user.name,
          })
        }
      }
      for (const recipient of Array.from(recipients.values())) {
        const sent = await sendProjectUpdateEmail({
          to: recipient.email,
          userName: recipient.name,
          projectName: updatedProject.name,
          projectLink,
        })
        if (sent) notificationsSent += 1
      }
    }

    return NextResponse.json({
      ...updatedProject,
      notificationsSent,
    })
  } catch (error: any) {
    console.error('Fel vid uppdatering av projekt:', error)
    return NextResponse.json({ error: 'Kunde inte uppdatera projekt' }, { status: 500 })
  }
}
