import type { CompanyModuleId } from '@/lib/companyModules'

/** Vilken modul som krävs för att nå en given app-sökväg (null = alltid tillåten). */
export function moduleRequiredForPath(pathname: string): CompanyModuleId | null {
  const path = (pathname || '/').split('?')[0]

  if (path.startsWith('/my-projects')) return 'projects'
  if (path.startsWith('/my-pages')) return 'employee_docs'

  if (path.startsWith('/create-project')) return 'projects'
  if (path.startsWith('/admin/vehicles')) return 'vehicles'
  if (path.startsWith('/admin/announcements')) return 'announcements'
  if (path.startsWith('/admin/payroll-hours')) return 'payroll'
  if (path.startsWith('/admin/customers') || path.startsWith('/admin/bundle-to-customer')) {
    return 'customer_portal'
  }

  return null
}
