import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, hashPassword } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

async function getAuthenticatedAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded || typeof decoded.userId !== 'string') return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { ownedCompany: true, company: true },
  })

  if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  const company = user.ownedCompany || user.company
  if (!company) return null

  return { actor: user, company }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const employeeId = params.id
    if (!employeeId) {
      return NextResponse.json({ error: 'Ogiltigt id' }, { status: 400 })
    }

    if (employeeId === auth.actor.id) {
      return NextResponse.json({ error: 'Du kan inte avsluta ditt eget konto på detta sätt.' }, { status: 400 })
    }

    const employee = await prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId: auth.company.id,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
        employmentEndedAt: null,
      },
      select: { id: true, email: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Personal hittades inte eller är redan avsluten.' }, { status: 404 })
    }

    const archivedEmail = `avslutad.${employee.id}.${Date.now()}@inactive.local`

    await prisma.user.update({
      where: { id: employee.id },
      data: {
        employmentEndedAt: new Date(),
        email: archivedEmail,
        password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    return NextResponse.json({
      message: 'Personal är avslutad och kan inte logga in igen till dess ett nytt konto skapas.',
    })
  } catch (error) {
    console.error('Fel vid avslut av personal:', error)
    return NextResponse.json({ error: 'Kunde inte avsluta personal' }, { status: 500 })
  }
}
