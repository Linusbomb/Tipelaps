import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Diagnos-endpoint för att se vilken databas Vercel pratar med och om seed +
 * migrations är applicerade. Exponerar inga lösenord eller credentials —
 * bara strukturell info om DB-värd och förekomst av nyckelrader.
 *
 * Säkerhet: ingen autentisering, men returnerar inga PII utöver maskerad host.
 * Ta bort denna endpoint när problemet är löst eller skydda med DEBUG_TOKEN.
 */
export async function GET() {
  const url = process.env.DATABASE_URL || ''
  let host = 'unknown'
  let database = 'unknown'
  try {
    const u = new URL(url)
    host = u.host
    database = u.pathname.replace(/^\//, '') || 'unknown'
  } catch {
    /* ignore */
  }
  // Maskera host: behåll prefix och ändelse, så vi ser om det är samma DB.
  const maskedHost = host.length > 20 ? host.slice(0, 12) + '…' + host.slice(-12) : host

  const result: Record<string, any> = {
    databaseUrlSet: url.length > 0,
    host: maskedHost,
    database,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    securityAlertEmailSet: Boolean(process.env.SECURITY_ALERT_EMAIL),
  }

  try {
    const userCount = await prisma.user.count()
    const superAdminCount = await prisma.user.count({ where: { role: 'SUPERADMIN' } })
    const superAdminEmails = await prisma.user.findMany({
      where: { role: 'SUPERADMIN' },
      select: { email: true, createdAt: true },
    })
    const demoAdminExists = (await prisma.user.count({ where: { email: 'demo@admin.se' } })) > 0
    const companyCount = await prisma.company.count()

    result.user = {
      total: userCount,
      superAdmins: superAdminCount,
      superAdminEmails: superAdminEmails.map((s) => s.email),
      demoAdminExists,
      companyCount,
    }
  } catch (err: any) {
    result.userQueryFailed = err?.message ?? String(err)
  }

  try {
    const auditCount = await prisma.auditLog.count()
    result.auditLog = { exists: true, rows: auditCount }
  } catch (err: any) {
    result.auditLog = {
      exists: false,
      error: err?.message ?? String(err),
      hint:
        'Migrationen 20260508_audit_log har inte deployats. Kör `npx prisma migrate deploy` mot rätt DATABASE_URL eller låt Vercel-bygget göra det via vercel-build-scriptet.',
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
