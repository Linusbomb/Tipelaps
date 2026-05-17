import { prisma } from '@/lib/prisma'

/** Konto markerat som avslutat av admin — ska inte få åtkomst via appen. */
export async function employmentHasEnded(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { employmentEndedAt: true },
  })
  return u?.employmentEndedAt != null
}
