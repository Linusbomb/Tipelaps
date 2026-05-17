import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_BLOCKED_ENDED'
  | 'LOGIN_WRONG_LOGIN_TYPE'
  | 'REGISTER_ENTREPRENEUR'
  | 'REGISTER_EMPLOYEE'
  | 'COMPANY_CREATE'
  | 'COMPANY_RENAME'
  | 'COMPANY_DELETE'
  | 'COMPANY_OWNER_PASSWORD_RESET'
  | 'IMPERSONATE_START'
  | 'IMPERSONATE_END'
  | 'EMPLOYEE_CREATE'
  | 'EMPLOYEE_UPDATE'
  | 'EMPLOYEE_END'
  | 'DATA_EXPORT_SELF'
  | 'DATA_EXPORT_COMPANY'
  | 'DATA_EXPORT_SUPERADMIN'

export type AuditActor = {
  id?: string | null
  email?: string | null
  role?: string | null
}

type AuditInput = {
  action: AuditAction
  actor?: AuditActor | null
  targetType?: string | null
  targetId?: string | null
  companyId?: string | null
  details?: Prisma.InputJsonValue | null
  request?: NextRequest | null
}

/**
 * Skriver en revisionsrad. Sväljer fel så att händelseloggning aldrig
 * orsakar att en API-route faller. Loggas till stderr om det misslyckas.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const { request } = input
    const ipHeader =
      request?.headers.get('x-forwarded-for') ||
      request?.headers.get('x-real-ip') ||
      null
    const ipAddress = ipHeader ? ipHeader.split(',')[0]?.trim() || null : null
    const userAgent = request?.headers.get('user-agent') || null

    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actorRole: input.actor?.role ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        companyId: input.companyId ?? null,
        details: input.details ?? Prisma.JsonNull,
        ipAddress,
        userAgent,
      },
    })
  } catch (err) {
    console.error('AuditLog write failed:', err)
  }
}
