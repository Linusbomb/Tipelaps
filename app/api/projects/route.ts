import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  return decoded?.userId || null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, ownedCompany: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 400 })
    }

    const companyIdScope = adminEffectiveCompanyId(user)
    if (!companyIdScope) {
      return NextResponse.json({ error: 'Användaren tillhör inget företag' }, { status: 400 })
    }

    // Hämta alla projekt för företaget
    const projects = await prisma.project.findMany({
      where: {
        companyId: companyIdScope,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    })

    return NextResponse.json(projects)
  } catch (error: any) {
    console.error('Fel vid hämtning av projekt:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta projekt' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const body = await request.json()
    const { name, address, startDate, customerId, employeeIds, employeeAssignments, latitude, longitude, description } = body

    const assignmentsFromPayload = Array.isArray(employeeAssignments)
      ? employeeAssignments
      : Array.isArray(employeeIds)
      ? employeeIds.map((employeeId: string) => ({ employeeId, equipment: null }))
      : []
    const assignedEmployeeIds = assignmentsFromPayload.map((item: any) => item.employeeId)

    // Validering
    if (
      !name ||
      !address ||
      !startDate ||
      !customerId ||
      !Array.isArray(assignmentsFromPayload) ||
      assignmentsFromPayload.length === 0
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

    const invalidAssignment = assignmentsFromPayload.find(
      (item: any) => !item?.employeeId || !item?.equipment || typeof item.equipment !== 'string'
    )
    if (invalidAssignment) {
      return NextResponse.json(
        { error: 'Varje vald anställd måste ha ett tilldelat fordon' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, ownedCompany: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 400 })
    }

    const companyIdScope = adminEffectiveCompanyId(user)
    if (!companyIdScope) {
      return NextResponse.json(
        { error: 'Användaren tillhör inget företag' },
        { status: 400 }
      )
    }

    // Kontrollera att kunden finns och tillhör samma företag
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer || customer.companyId !== companyIdScope) {
      return NextResponse.json(
        { error: 'Kunden hittades inte eller tillhör inte ditt företag' },
        { status: 400 }
      )
    }

    // Kontrollera att alla valda anställda tillhör samma företag
    const employees = await prisma.user.findMany({
      where: {
        id: { in: assignedEmployeeIds },
        companyId: companyIdScope,
        employmentEndedAt: null,
      },
    })

    if (employees.length !== assignedEmployeeIds.length) {
      return NextResponse.json(
        { error: 'En eller flera valda anställda tillhör inte ditt företag' },
        { status: 400 }
      )
    }

    // Skapa projektet
    const project = await prisma.project.create({
      data: {
        companyId: companyIdScope,
        customerId,
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
        startDate: new Date(startDate),
        description: description?.trim() || null,
        employees: {
          create: assignmentsFromPayload.map((assignment: any) => ({
            userId: assignment.employeeId,
            assignedEquipment: assignment.equipment.trim(),
          })),
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        employees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Fel vid skapande av projekt:', error)
    return NextResponse.json(
      { error: 'Kunde inte skapa projekt' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, employeeAssignments } = body

    if (!projectId || !Array.isArray(employeeAssignments) || employeeAssignments.length === 0) {
      return NextResponse.json(
        { error: 'Projekt och minst en tilldelad anställd krävs' },
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true, ownedCompany: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyIdScope = adminEffectiveCompanyId(user)
    if (!companyIdScope || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { employees: true },
    })
    if (!project || project.companyId !== companyIdScope) {
      return NextResponse.json({ error: 'Projekt hittades inte eller saknar behörighet' }, { status: 404 })
    }

    const assignedEmployeeIds = employeeAssignments.map((item: any) => item.employeeId)
    const employees = await prisma.user.findMany({
      where: {
        id: { in: assignedEmployeeIds },
        companyId: companyIdScope,
        employmentEndedAt: null,
        role: 'EMPLOYEE',
      },
      select: { id: true },
    })
    if (employees.length !== assignedEmployeeIds.length) {
      return NextResponse.json(
        { error: 'En eller flera valda anställda tillhör inte ditt företag eller är avslutade' },
        { status: 400 }
      )
    }

    const existingAssignments = project.employees
    const incomingByUserId = new Map(
      employeeAssignments.map((item: any) => [item.employeeId, item.equipment.trim()])
    )

    const toDelete = existingAssignments.filter((assignment) => !incomingByUserId.has(assignment.userId))
    const toUpdate = existingAssignments.filter((assignment) => incomingByUserId.has(assignment.userId))
    const existingUserIds = new Set(existingAssignments.map((assignment) => assignment.userId))
    const toCreate = employeeAssignments.filter((item: any) => !existingUserIds.has(item.employeeId))

    await prisma.$transaction([
      ...toDelete.map((assignment) =>
        prisma.projectEmployee.delete({ where: { id: assignment.id } })
      ),
      ...toUpdate.map((assignment) =>
        prisma.projectEmployee.update({
          where: { id: assignment.id },
          data: {
            assignedEquipment: incomingByUserId.get(assignment.userId),
          },
        })
      ),
      ...toCreate.map((item: any) =>
        prisma.projectEmployee.create({
          data: {
            projectId,
            userId: item.employeeId,
            assignedEquipment: item.equipment.trim(),
            accepted: false,
            acceptedAt: null,
          },
        })
      ),
    ])

    const updatedProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updatedProject)
  } catch (error: any) {
    console.error('Fel vid uppdatering av projektpersonal:', error)
    return NextResponse.json(
      { error: 'Kunde inte uppdatera projektpersonal' },
      { status: 500 }
    )
  }
}
