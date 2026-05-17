import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export const ADMIN_ROLES = ['ENTREPRENEUR', 'PAYROLL_COORDINATOR'] as const
export const SUPERADMIN_ROLE = 'SUPERADMIN' as const

export function isAdminRole(role: string | null | undefined) {
  return role === 'ENTREPRENEUR' || role === 'PAYROLL_COORDINATOR'
}

export function isSuperAdminRole(role: string | null | undefined) {
  return role === SUPERADMIN_ROLE
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Genererar en kortlivad JWT (1 timme) för superadmin-impersonering.
 * Innehåller `actingAs` så servern kan särskilja vem som faktiskt initierade
 * sessionen (för revisionslogg) och `imp: true` för att markera typen.
 */
export function generateImpersonationToken(
  userId: string,
  email: string,
  role: string,
  actingAs: { id: string; email: string }
): string {
  return jwt.sign(
    { userId, email, role, imp: true, actingAs },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

export type DecodedToken = {
  userId: string
  email: string
  role: string
  imp?: boolean
  actingAs?: { id: string; email: string }
}

export function verifyToken(token: string): DecodedToken | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (typeof payload !== 'object' || payload === null) return null
    const { userId, email, role, imp, actingAs } = payload as Record<string, unknown>
    if (typeof userId !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      return null
    }
    const decoded: DecodedToken = { userId, email, role }
    if (imp === true) decoded.imp = true
    if (
      actingAs &&
      typeof actingAs === 'object' &&
      typeof (actingAs as any).id === 'string' &&
      typeof (actingAs as any).email === 'string'
    ) {
      decoded.actingAs = {
        id: (actingAs as any).id,
        email: (actingAs as any).email,
      }
    }
    return decoded
  } catch {
    return null
  }
}

/** Hämtar inloggad användare från `Authorization: Bearer <token>`. Returnerar null om ogiltig. */
export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })

  if (!user) return null
  if (user.employmentEndedAt != null) return null
  return user
}

/** Returnerar användaren om SUPERADMIN, annars null. */
export async function requireSuperAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user || !isSuperAdminRole(user.role)) return null
  return user
}
