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

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json(
        { error: 'Projekt-ID krävs' },
        { status: 400 }
      )
    }

    const projectEmployee = await prisma.projectEmployee.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    })

    if (!projectEmployee) {
      return NextResponse.json(
        { error: 'Du är inte tilldelad till detta projekt' },
        { status: 403 }
      )
    }

    if (!projectEmployee.accepted) {
      return NextResponse.json(
        { error: 'Du måste först acceptera projektet' },
        { status: 400 }
      )
    }

    const updated = await prisma.projectEmployee.update({
      where: { id: projectEmployee.id },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      completed: updated.completed,
      completedAt: updated.completedAt,
    })
  } catch (error: any) {
    console.error('Fel vid slutförande av projekt:', error)
    return NextResponse.json(
      { error: 'Kunde inte markera projekt som slutfört' },
      { status: 500 }
    )
  }
}
