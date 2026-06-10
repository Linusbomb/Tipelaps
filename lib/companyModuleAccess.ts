import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { isSuperAdminRole } from '@/lib/auth'
import {
  COMPANY_MODULE_IDS,
  DEFAULT_START_PACKAGE_MODULES,
  MODULE_DISABLED_MESSAGE,
  type CompanyModuleId,
  isCompanyModuleId,
} from '@/lib/companyModules'

export type CompanyModuleState = {
  moduleId: CompanyModuleId
  enabled: boolean
  enabledAt: string
  enabledBy: string | null
}

export async function getEnabledCompanyModules(companyId: string): Promise<CompanyModuleId[]> {
  const [enabledRows, configuredCount] = await Promise.all([
    prisma.companyFeature.findMany({
      where: { companyId, enabled: true },
      select: { moduleId: true },
    }),
    prisma.companyFeature.count({ where: { companyId } }),
  ])

  if (configuredCount === 0) {
    return [...DEFAULT_START_PACKAGE_MODULES]
  }

  const enabled = enabledRows.map((row) => row.moduleId).filter(isCompanyModuleId)

  return enabled.includes('time_reports')
    ? enabled
    : (['time_reports', ...enabled] as CompanyModuleId[])
}

export async function getCompanyModuleStates(companyId: string): Promise<CompanyModuleState[]> {
  const rows = await prisma.companyFeature.findMany({
    where: { companyId },
    orderBy: { moduleId: 'asc' },
  })

  if (rows.length === 0) {
    const now = new Date().toISOString()
    return DEFAULT_START_PACKAGE_MODULES.map((moduleId) => ({
      moduleId,
      enabled: true,
      enabledAt: now,
      enabledBy: null,
    }))
  }

  const byId = new Map(rows.map((row) => [row.moduleId, row]))
  return COMPANY_MODULE_IDS.map((moduleId) => {
    const row = byId.get(moduleId)
    return {
      moduleId,
      enabled: moduleId === 'time_reports' ? true : row?.enabled ?? false,
      enabledAt: (row?.enabledAt ?? new Date()).toISOString(),
      enabledBy: row?.enabledBy ?? null,
    }
  })
}

export async function ensureDefaultCompanyModules(
  companyId: string,
  enabledBy?: string | null
): Promise<void> {
  const existing = await prisma.companyFeature.count({ where: { companyId } })
  if (existing > 0) return

  await prisma.companyFeature.createMany({
    data: DEFAULT_START_PACKAGE_MODULES.map((moduleId) => ({
      companyId,
      moduleId,
      enabled: true,
      enabledBy: enabledBy ?? null,
    })),
    skipDuplicates: true,
  })
}

export async function setCompanyModules(
  companyId: string,
  modules: Array<{ moduleId: CompanyModuleId; enabled: boolean }>,
  enabledBy?: string | null
): Promise<CompanyModuleState[]> {
  await ensureDefaultCompanyModules(companyId, enabledBy)

  for (const entry of modules) {
    if (entry.moduleId === 'time_reports') continue
    await prisma.companyFeature.upsert({
      where: {
        companyId_moduleId: {
          companyId,
          moduleId: entry.moduleId,
        },
      },
      create: {
        companyId,
        moduleId: entry.moduleId,
        enabled: entry.enabled,
        enabledBy: enabledBy ?? null,
      },
      update: {
        enabled: entry.enabled,
        enabledBy: enabledBy ?? null,
      },
    })
  }

  return getCompanyModuleStates(companyId)
}

export async function companyHasModule(
  companyId: string | null | undefined,
  moduleId: CompanyModuleId
): Promise<boolean> {
  if (!companyId) return false
  if (moduleId === 'time_reports') return true
  const enabled = await getEnabledCompanyModules(companyId)
  return enabled.includes(moduleId)
}

export function moduleForbiddenResponse() {
  return NextResponse.json({ error: MODULE_DISABLED_MESSAGE }, { status: 403 })
}

type GuardUser = NonNullable<Awaited<ReturnType<typeof getAdminApiUser>>>

export async function requireCompanyModuleAccess(
  request: NextRequest,
  moduleId: CompanyModuleId
): Promise<
  | { ok: true; user: GuardUser; companyId: string }
  | { ok: false; response: NextResponse }
> {
  const user = await getAdminApiUser(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 }) }
  }

  if (isSuperAdminRole(user.role)) {
    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Superadmin saknar företagskontext' }, { status: 403 }),
      }
    }
    return { ok: true, user, companyId }
  }

  const companyId = adminEffectiveCompanyId(user)
  if (!companyId) {
    return { ok: false, response: NextResponse.json({ error: 'Ej behörig' }, { status: 403 }) }
  }

  const allowed = await companyHasModule(companyId, moduleId)
  if (!allowed) {
    return { ok: false, response: moduleForbiddenResponse() }
  }

  return { ok: true, user, companyId }
}

const ADMIN_ROLES = new Set(['ENTREPRENEUR', 'PAYROLL_COORDINATOR'])

export async function requireAdminCompanyModule(
  request: NextRequest,
  moduleId: CompanyModuleId
): Promise<
  | { ok: true; user: GuardUser; companyId: string }
  | { ok: false; response: NextResponse }
> {
  const access = await requireCompanyModuleAccess(request, moduleId)
  if (!access.ok) return access
  if (!ADMIN_ROLES.has(access.user.role) && !isSuperAdminRole(access.user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Ej behörig' }, { status: 403 }) }
  }
  return access
}

export async function requireCompanyModuleForUser(
  user: { role: string; companyId: string | null; ownedCompany?: { id: string } | null },
  moduleId: CompanyModuleId
): Promise<boolean> {
  if (isSuperAdminRole(user.role)) return true
  const companyId = user.ownedCompany?.id ?? user.companyId
  return companyHasModule(companyId, moduleId)
}
