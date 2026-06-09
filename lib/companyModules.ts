export const COMPANY_MODULE_IDS = [
  'time_reports',
  'projects',
  'vehicles',
  'announcements',
  'payroll',
  'customer_portal',
  'employee_docs',
  'vacation',
] as const

export type CompanyModuleId = (typeof COMPANY_MODULE_IDS)[number]

export type CompanyModuleDefinition = {
  id: CompanyModuleId
  label: string
  description: string
  alwaysOn?: boolean
}

export const COMPANY_MODULE_DEFINITIONS: CompanyModuleDefinition[] = [
  {
    id: 'time_reports',
    label: 'Tidrapportering',
    description: 'Kärnfunktion — tidrapporter, frånvaro och översikt.',
    alwaysOn: true,
  },
  {
    id: 'projects',
    label: 'Projekt',
    description: 'Skapa projekt, tilldela personal och koppla tid till projekt.',
  },
  {
    id: 'vehicles',
    label: 'Fordon',
    description: 'Fordonsregister och fordonskoppling i tidrapporter.',
  },
  {
    id: 'announcements',
    label: 'Nyheter',
    description: 'Interna nyheter med bilagor till personalen.',
  },
  {
    id: 'payroll',
    label: 'Lön & tid',
    description: 'Löneunderlag, export och sammanställning per månad.',
  },
  {
    id: 'customer_portal',
    label: 'Kundpaket',
    description: 'Kundregister, paketera rapporter och skicka till kund.',
  },
  {
    id: 'employee_docs',
    label: 'Personaldokument',
    description: 'Uppladdning och hantering av personalens dokument.',
  },
  {
    id: 'vacation',
    label: 'Semesterplanering',
    description: 'Planera och följa upp personalens semesterveckor.',
  },
]

/** Startpaket = allt som systemet har idag. */
export const DEFAULT_START_PACKAGE_MODULES: CompanyModuleId[] = [...COMPANY_MODULE_IDS]

export const MODULE_DISABLED_MESSAGE =
  'Denna funktion är inte aktiverad för ert konto. Kontakta LVtech om ni vill aktivera modulen.'

export function isCompanyModuleId(value: string): value is CompanyModuleId {
  return (COMPANY_MODULE_IDS as readonly string[]).includes(value)
}

export function companyModuleLabel(moduleId: CompanyModuleId): string {
  return COMPANY_MODULE_DEFINITIONS.find((item) => item.id === moduleId)?.label ?? moduleId
}

export function companyModuleNavRequirement(navItemId: string): CompanyModuleId | null {
  switch (navItemId) {
    case 'work-time-reports':
      return 'time_reports'
    case 'work-projects':
      return 'projects'
    case 'work-vehicles':
      return 'vehicles'
    case 'staff-payroll':
      return 'payroll'
    case 'customers':
      return 'customer_portal'
    case 'announcements':
      return 'announcements'
    default:
      return null
  }
}

export function isModuleEnabled(
  enabledModules: readonly CompanyModuleId[],
  moduleId: CompanyModuleId | null
): boolean {
  if (!moduleId) return true
  if (moduleId === 'time_reports') return true
  return enabledModules.includes(moduleId)
}
