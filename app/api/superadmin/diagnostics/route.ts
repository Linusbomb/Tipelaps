import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function maskDatabaseHost(url: string): string {
  try {
    const host = new URL(url).host
    return host.length > 20 ? `${host.slice(0, 12)}…${host.slice(-12)}` : host
  } catch {
    return 'unknown'
  }
}

/** Hjälper superadmin verifiera att live och lokal miljö pratar med samma databas. */
export async function GET(request: NextRequest) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const databaseUrl = process.env.DATABASE_URL || ''
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    {
      databaseHost: maskDatabaseHost(databaseUrl),
      databaseConfigured: databaseUrl.length > 0,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      companyCount: companies.length,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
