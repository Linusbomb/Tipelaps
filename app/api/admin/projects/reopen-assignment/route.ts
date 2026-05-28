import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'

export const dynamic = 'force-dynamic'

/** Admin: återöppna en personal tilldelning som markerats slutförd av misstag. */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminApiUser(request)
    if (!admin) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (admin.role !== 'ENTREPRENEUR' && admin.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(admin)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json()
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: 'Projekt-ID och personal-ID krävs' },
        { status: 400 }
      )
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt hittades inte' }, { status: 404 })
    }

    const assignment = await prisma.projectEmployee.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Personen är inte tilldelad projektet' }, { status: 404 })
    }

    if (!assignment.completed) {
      return NextResponse.json({
        success: true,
        alreadyOpen: true,
      })
    }

    const updated = await prisma.projectEmployee.update({
      where: { id: assignment.id },
      data: {
        completed: false,
        completedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      completed: updated.completed,
      completedAt: updated.completedAt,
    })
  } catch (error) {
    console.error('[admin/reopen-assignment]', error)
    return NextResponse.json(
      { error: 'Kunde inte öppna upp projektet igen' },
      { status: 500 }
    )
  }
}
