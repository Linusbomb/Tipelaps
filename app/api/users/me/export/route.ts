import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * GDPR – rätt till tillgång och dataportabilitet (art. 15 + 20).
 * Returnerar all personuppgift om den inloggade användaren som maskinläsbar JSON.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
  }

  const [profile, timeReports, documents, kin, projects, vacation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        employeeCategory: true,
        role: true,
        companyId: true,
        profileImagePath: true,
        createdAt: true,
        updatedAt: true,
        employmentEndedAt: true,
      },
    }),
    prisma.timeReport.findMany({
      where: { userId: user.id },
      include: {
        entries: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.employeeDocument.findMany({ where: { userId: user.id } }),
    prisma.nextOfKin.findMany({ where: { userId: user.id } }),
    prisma.projectEmployee.findMany({
      where: { userId: user.id },
      include: { project: { select: { id: true, name: true, address: true } } },
    }),
    prisma.vacationWeek.findMany({ where: { userId: user.id } }),
  ])

  await logAudit({
    action: 'DATA_EXPORT_SELF',
    actor: { id: user.id, email: user.email, role: user.role },
    companyId: user.companyId,
    targetType: 'User',
    targetId: user.id,
    request,
  })

  const body = {
    exportedAt: new Date().toISOString(),
    notice:
      'Detta är en GDPR-export av dina personuppgifter. Lösenord ingår aldrig. Hashade lösen och säkerhetstokens har medvetet uteslutits.',
    profile,
    timeReports,
    documents,
    nextOfKin: kin,
    projects,
    vacation,
  }

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="timelaps-mina-uppgifter-${user.id}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
