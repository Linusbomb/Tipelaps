/** Normal arbetstid per dag (timmar) – övertid = total arbetstid minus detta. */
export const STANDARD_DAY_HOURS = 8

/** Övertid i timmar (0 om total ≤ 8 h). Avrundas till hundradel. */
export function computeOvertimeHours(totalHours: number): number {
  if (!Number.isFinite(totalHours) || totalHours <= STANDARD_DAY_HOURS) return 0
  return Math.round((totalHours - STANDARD_DAY_HOURS) * 100) / 100
}

/** Visning: "2" eller "2,5" (svensk decimal). */
export function formatOvertimeHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0'
  const rounded = Math.round(hours * 100) / 100
  if (rounded % 1 === 0) return String(rounded)
  return rounded.toFixed(1).replace('.', ',')
}

import { prisma } from '@/lib/prisma'

/** Skriver övertid till DB (fungerar även om Prisma-klienten inte är regenererad än). */
export async function persistReportOvertimeHours(
  reportId: string,
  totalHours: number
): Promise<void> {
  const overtimeHours = computeOvertimeHours(totalHours)
  await prisma.$executeRaw`
    UPDATE "TimeReport" SET "overtimeHours" = ${overtimeHours} WHERE "id" = ${reportId}
  `
}

/** Värde från databas om satt, annars räkna om (t.ex. äldre rapporter före backfill). */
export function resolveOvertimeHours(
  stored: number | null | undefined,
  totalHours: number
): number {
  const computed = computeOvertimeHours(totalHours)
  if (stored == null || !Number.isFinite(stored)) return computed
  if (stored > 0) return stored
  return computed
}
