import { prisma } from '@/lib/prisma'

export type PayrollStaffMember = {
  id: string
  name: string
  email: string
  role: string
}

/** Alla som ska synas under Arbetstid för lön: personal, lönesamordnare och företagets ägare (admin). */
export async function getPayrollStaffForCompany(companyId: string): Promise<PayrollStaffMember[]> {
  const [company, members] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employmentEndedAt: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        companyId,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR', 'ENTREPRENEUR'] },
      },
      select: { id: true, name: true, email: true, role: true },
    }),
  ])

  const byId = new Map<string, PayrollStaffMember>()
  for (const m of members) {
    byId.set(m.id, m)
  }

  const owner = company?.owner
  if (owner && !owner.employmentEndedAt && !byId.has(owner.id)) {
    byId.set(owner.id, {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
    })
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'sv'))
}
