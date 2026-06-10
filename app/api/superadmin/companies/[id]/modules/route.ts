import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  getCompanyModuleStates,
  setCompanyModules,
} from '@/lib/companyModuleAccess'
import {
  COMPANY_MODULE_DEFINITIONS,
  COMPANY_MODULE_IDS,
  type CompanyModuleId,
} from '@/lib/companyModules'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const modules = await getCompanyModuleStates(params.id)
  return NextResponse.json({
    modules,
    definitions: COMPANY_MODULE_DEFINITIONS,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const rawModules =
    body && typeof body === 'object' && Array.isArray((body as { modules?: unknown }).modules)
      ? (body as { modules: Array<{ moduleId?: unknown; enabled?: unknown }> }).modules
      : null

  if (!rawModules) {
    return NextResponse.json({ error: 'modules krävs' }, { status: 400 })
  }

  const before = await getCompanyModuleStates(params.id)
  const updates: Array<{ moduleId: CompanyModuleId; enabled: boolean }> = []

  for (const moduleId of COMPANY_MODULE_IDS) {
    if (moduleId === 'time_reports') continue
    const entry = rawModules.find((item) => item.moduleId === moduleId)
    updates.push({
      moduleId,
      enabled: entry?.enabled === true,
    })
  }

  const modules = await setCompanyModules(params.id, updates, superAdmin.id)

  const changed = modules.filter((entry) => {
    const previous = before.find((item) => item.moduleId === entry.moduleId)
    return previous?.enabled !== entry.enabled
  })

  if (changed.length > 0) {
    await logAudit({
      action: 'COMPANY_MODULES_UPDATE',
      actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
      targetType: 'Company',
      targetId: company.id,
      companyId: company.id,
      details: {
        companyName: company.name,
        changed: changed.map((entry) => ({
          moduleId: entry.moduleId,
          enabled: entry.enabled,
        })),
      },
      request,
    })
  }

  return NextResponse.json({ modules, definitions: COMPANY_MODULE_DEFINITIONS })
}
