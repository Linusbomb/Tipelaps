export type AdminNavItem = {
  id: string
  href: string
  label: string
  matchPrefixes?: string[]
}

export type AdminNavGroup =
  | {
      id: string
      label: string
      href: string
      matchPrefixes?: string[]
    }
  | {
      id: string
      label: string
      items: AdminNavItem[]
    }

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    label: 'Översikt',
    href: '/dashboard',
    matchPrefixes: ['/dashboard'],
  },
  {
    id: 'work',
    label: 'Arbete',
    items: [
      {
        id: 'work-time-reports',
        href: '/admin',
        label: 'Tidrapportering',
        matchPrefixes: ['/admin', '/admin/time-reports'],
      },
      {
        id: 'work-projects',
        href: '/create-project',
        label: 'Projekt',
        matchPrefixes: ['/create-project'],
      },
      {
        id: 'work-vehicles',
        href: '/admin/vehicles',
        label: 'Fordon',
        matchPrefixes: ['/admin/vehicles'],
      },
    ],
  },
  {
    id: 'staff',
    label: 'Personal',
    items: [
      {
        id: 'staff-employees',
        href: '/admin/my-staff',
        label: 'Personal',
        matchPrefixes: ['/admin/my-staff', '/admin/employee'],
      },
      {
        id: 'staff-payroll',
        href: '/admin/payroll-hours',
        label: 'Lön & tid',
        matchPrefixes: ['/admin/payroll-hours'],
      },
    ],
  },
  {
    id: 'customers',
    label: 'Kunder',
    href: '/admin/customers',
    matchPrefixes: ['/admin/customers', '/admin/bundle-to-customer'],
  },
  {
    id: 'announcements',
    label: 'Nyheter',
    href: '/admin/announcements',
    matchPrefixes: ['/admin/announcements'],
  },
  {
    id: 'my-pages',
    label: 'Min sida',
    href: '/my-pages',
    matchPrefixes: ['/my-pages'],
  },
]

function normalizePath(pathname: string): string {
  return (pathname || '/').split('?')[0]
}

function pathMatches(pathname: string, href: string, extraPrefixes?: string[]): boolean {
  const path = normalizePath(pathname)
  if (path === href) return true
  const prefixes = extraPrefixes ?? [href]
  return prefixes.some((prefix) => {
    if (path === prefix) return true
    if (prefix === '/admin') {
      return path === '/admin' || path.startsWith('/admin/time-reports')
    }
    return path.startsWith(`${prefix}/`) || path.startsWith(prefix)
  })
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  return pathMatches(pathname, item.href, item.matchPrefixes)
}

export function isAdminNavGroupActive(pathname: string, group: AdminNavGroup): boolean {
  if ('href' in group) {
    return pathMatches(pathname, group.href, group.matchPrefixes)
  }
  return group.items.some((item) => isAdminNavItemActive(pathname, item))
}

export function getAdminNavGroups(): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS
}
