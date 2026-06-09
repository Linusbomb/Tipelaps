import type { AdminNavGroup, AdminNavItem } from '@/lib/adminNav'
import {
  companyModuleNavRequirement,
  isModuleEnabled,
  type CompanyModuleId,
} from '@/lib/companyModules'

function navItemAllowed(itemId: string, enabledModules: readonly CompanyModuleId[]): boolean {
  const requirement = companyModuleNavRequirement(itemId)
  return isModuleEnabled(enabledModules, requirement)
}

function filterNavItem(item: AdminNavItem, enabledModules: readonly CompanyModuleId[]): AdminNavItem | null {
  if (!navItemAllowed(item.id, enabledModules)) return null
  return item
}

export function filterAdminNavGroups(
  groups: AdminNavGroup[],
  enabledModules: readonly CompanyModuleId[]
): AdminNavGroup[] {
  return groups
    .map((group) => {
      if ('href' in group) {
        if (!navItemAllowed(group.id, enabledModules)) return null
        return group
      }

      const items = group.items
        .map((item) => filterNavItem(item, enabledModules))
        .filter((item): item is AdminNavItem => item !== null)

      if (items.length === 0) return null
      return { ...group, items }
    })
    .filter((group): group is AdminNavGroup => group !== null)
}
