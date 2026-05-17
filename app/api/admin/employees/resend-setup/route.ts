import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendSetPasswordEmail } from '@/lib/email'
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

  return { user, company }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const body = await request.json()
    const employeeId = body?.employeeId as string
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId krävs' }, { status: 400 })
    }

    const employee = await prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId: auth.company.id,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 })
    }

    const setupToken = crypto.randomBytes(32).toString('hex')
    const setupExpires = new Date()
    setupExpires.setDate(setupExpires.getDate() + 7)

    await prisma.user.update({
      where: { id: employee.id },
      data: {
        passwordResetToken: setupToken,
        passwordResetExpires: setupExpires,
      },
    })

    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`
      } else {
        baseUrl = 'http://localhost:3000'
      }
    }
    const setupLink = `${baseUrl}/reset-password?token=${setupToken}`
    const emailSent = await sendSetPasswordEmail(employee.email, setupLink, employee.name, auth.user.name)

    if (!emailSent) {
      return NextResponse.json({ error: 'Kunde inte skicka aktiveringsmejl' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Aktiveringsmejl skickat' })
  } catch (error) {
    console.error('Fel vid omskick av aktiveringsmejl:', error)
    return NextResponse.json({ error: 'Kunde inte skicka aktiveringsmejl' }, { status: 500 })
  }
}
