import { NextRequest, NextResponse } from 'next/server'
import { getAdminApiUser, adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { getEnabledCompanyModules } from '@/lib/companyModuleAccess'
import { COMPANY_MODULE_DEFINITIONS } from '@/lib/companyModules'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAdminApiUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
  }

  const companyId = adminEffectiveCompanyId(user)
  if (!companyId) {
    return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
  }

  const modules = await getEnabledCompanyModules(companyId)
  return NextResponse.json({
    modules,
    definitions: COMPANY_MODULE_DEFINITIONS,
  })
}
