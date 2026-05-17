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

    // Kontrollera att användaren är tilldelad till projektet
    const projectEmployee = await prisma.projectEmployee.findUnique({
      where: {
        projectId_userId: {
          projectId: projectId,
          userId: userId,
        },
      },
    })

    if (!projectEmployee) {
      return NextResponse.json(
        { error: 'Du är inte tilldelad till detta projekt' },
        { status: 403 }
      )
    }

    // Uppdatera acceptansstatus
    const updated = await prisma.projectEmployee.update({
      where: {
        id: projectEmployee.id,
      },
      data: {
        accepted: true,
        acceptedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, accepted: updated.accepted, acceptedAt: updated.acceptedAt })
  } catch (error: any) {
    console.error('Fel vid acceptering av projekt:', error)
    return NextResponse.json(
      { error: 'Kunde inte acceptera projekt' },
      { status: 500 }
    )
  }
}
