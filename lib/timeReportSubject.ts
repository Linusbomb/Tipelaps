import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { employmentHasEnded } from '@/lib/accountStatus'

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

export type TimeReportSubjectResult =
  | { ok: true; actorId: string; reportUserId: string; companyId: string }
  | { ok: false; response: NextResponse }

/** Vem tidrapporten gäller: anställd själv, eller admin åt vald personal. */
export async function resolveTimeReportSubject(
  actorId: string,
  forUserIdInput: unknown
): Promise<TimeReportSubjectResult> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: {
      role: true,
      companyId: true,
      ownedCompany: { select: { id: true } },
    },
  })

  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 }),
    }
  }

  const companyId = adminEffectiveCompanyId(actor)
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Användaren tillhör inget företag' },
        { status: 400 }
      ),
    }
  }

  const forUserId =
    typeof forUserIdInput === 'string' && forUserIdInput.trim()
      ? forUserIdInput.trim()
      : actorId

  if (forUserId === actorId) {
    if (await employmentHasEnded(actorId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Ditt arbetskonto är avslutat.', inactive: true },
          { status: 403 }
        ),
      }
    }
    return { ok: true, actorId, reportUserId: actorId, companyId }
  }

  if (!ADMIN_ROLES.has(actor.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Du kan bara skapa tidrapporter för dig själv' },
        { status: 403 }
      ),
    }
  }

  const target = await prisma.user.findFirst({
    where: {
      id: forUserId,
      companyId,
      employmentEndedAt: null,
      role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
    },
    select: { id: true },
  })

  if (!target) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Vald person hittades inte i ditt företag' },
        { status: 404 }
      ),
    }
  }

  return { ok: true, actorId, reportUserId: target.id, companyId }
}
