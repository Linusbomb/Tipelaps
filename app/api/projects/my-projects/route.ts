import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'

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

    if (await employmentHasEnded(userId)) {
      return NextResponse.json(
        { error: 'Ditt arbetskonto är avslutat.', inactive: true },
        { status: 403 }
      )
    }

    // Hämta alla projekt där användaren är tilldelad
    const projectEmployees = await prisma.projectEmployee.findMany({
      where: {
        userId: userId,
      },
      include: {
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            attachments: {
              orderBy: { createdAt: 'desc' },
              take: 30,
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
        },
      },
      orderBy: {
        project: {
          startDate: 'desc',
        },
      },
    })

    // Extrahera projekten från relationerna och lägg till accepted-status
    const projects = projectEmployees.map(pe => ({
      ...pe.project,
      accepted: pe.accepted,
      acceptedAt: pe.acceptedAt,
      completed: pe.completed,
      completedAt: pe.completedAt,
      assignedEquipment: pe.assignedEquipment,
    }))

    return NextResponse.json(projects)
  } catch (error: any) {
    console.error('Fel vid hämtning av projekt:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta projekt' },
      { status: 500 }
    )
  }
}
