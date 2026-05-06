import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function getAdminApiUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null
  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

export function adminEffectiveCompanyId(user: {
  ownedCompany?: { id: string } | null
  companyId: string | null
}): string | null {
  return user.ownedCompany?.id ?? user.companyId ?? null
}
