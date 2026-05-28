import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { employmentHasEnded } from '@/lib/accountStatus'
import { roundHours, sumEntryMachineHours } from '@/lib/projectHours'

export const dynamic = 'force-dynamic'

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const decoded = verifyToken(authHeader.substring(7))
  return decoded?.userId || null
}

/** Personal: endast egna tidrapporter kopplade till projektet (projectId). */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
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

    const projectId = params.projectId?.trim()
    if (!projectId) {
      return NextResponse.json({ error: 'Ogiltigt projekt' }, { status: 400 })
    }

    const assignment = await prisma.projectEmployee.findFirst({
      where: { projectId, userId },
      select: { id: true },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Du är inte tilldelad detta projekt' }, { status: 403 })
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { id: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt hittades inte' }, { status: 404 })
    }

    const reports = await prisma.timeReport.findMany({
      where: {
        projectId,
        userId,
      },
      select: {
        id: true,
        date: true,
        month: true,
        totalHours: true,
        status: true,
        entries: {
          select: {
            machineHours: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    let totalHours = 0
    let totalMachineHours = 0

    const list = reports.map((report) => {
      const machineHours = sumEntryMachineHours(report.entries)
      totalHours += report.totalHours ?? 0
      totalMachineHours += machineHours
      return {
        id: report.id,
        date: report.date,
        month: report.month,
        totalHours: report.totalHours,
        machineHours: roundHours(machineHours),
        status: report.status,
      }
    })

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      reports: list,
      summary: {
        totalHours: roundHours(totalHours),
        totalMachineHours: roundHours(totalMachineHours),
        reportCount: list.length,
      },
    })
  } catch (error) {
    console.error('[projects/my-hours]', error)
    return NextResponse.json({ error: 'Kunde inte hämta timmar' }, { status: 500 })
  }
}
