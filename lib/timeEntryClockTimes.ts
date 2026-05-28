import { prisma } from '@/lib/prisma'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function cleanClockTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return TIME_RE.test(trimmed) ? trimmed : null
}

export async function persistTimeEntryClockTimes(
  entries: Array<{ id: string }>,
  sourceRows: Array<{ startTime?: unknown; endTime?: unknown }>
) {
  await Promise.all(
    entries.map((entry, index) =>
      prisma.$executeRaw`
        UPDATE "TimeReportEntry"
        SET "startTime" = ${cleanClockTime(sourceRows[index]?.startTime)},
            "endTime" = ${cleanClockTime(sourceRows[index]?.endTime)}
        WHERE "id" = ${entry.id}
      `
    )
  )
}
