import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireSuperAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendSetPasswordEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['LASTBILSCHAUFOR', 'MASKINFORARE', 'MARKANLAGGARE', 'TJANSTEMAN']

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  const companyId = params.id
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const targetRole = body.role === 'PAYROLL_COORDINATOR' ? 'PAYROLL_COORDINATOR' : 'EMPLOYEE'
  const employeeCategory =
    typeof body.employeeCategory === 'string' ? body.employeeCategory.trim() : ''
  const setupMethod =
    body.passwordSetupMethod === 'EMAIL_LINK' ? 'EMAIL_LINK' : 'ADMIN_PASSWORD'
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name || !email) {
    return NextResponse.json({ error: 'Namn och e-post krävs' }, { status: 400 })
  }
  if (
    targetRole === 'EMPLOYEE' &&
    employeeCategory &&
    !VALID_CATEGORIES.includes(employeeCategory)
  ) {
    return NextResponse.json({ error: 'Ogiltig personalkategori' }, { status: 400 })
  }
  if (setupMethod === 'ADMIN_PASSWORD' && password.length < 6) {
    return NextResponse.json(
      { error: 'Lösenord måste vara minst 6 tecken' },
      { status: 400 }
    )
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json(
      { error: 'En användare med denna e-post finns redan' },
      { status: 400 }
    )
  }

  const passwordToSave =
    setupMethod === 'ADMIN_PASSWORD' ? password : crypto.randomBytes(16).toString('hex')
  const hashedPassword = await hashPassword(passwordToSave)
  const setupToken = setupMethod === 'EMAIL_LINK' ? crypto.randomBytes(32).toString('hex') : null
  const setupExpires = setupMethod === 'EMAIL_LINK' ? new Date() : null
  if (setupExpires) {
    setupExpires.setDate(setupExpires.getDate() + 7)
  }

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      phone: phone || null,
      employeeCategory:
        targetRole === 'EMPLOYEE' && employeeCategory ? employeeCategory : null,
      role: targetRole,
      companyId: company.id,
      passwordResetToken: setupToken,
      passwordResetExpires: setupExpires,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      employeeCategory: true,
      role: true,
      createdAt: true,
    },
  })

  if (setupMethod === 'EMAIL_LINK') {
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
    }
    const setupLink = `${baseUrl}/reset-password?token=${setupToken}`
    const emailSent = await sendSetPasswordEmail(
      email,
      setupLink,
      name,
      superAdmin.name
    )
    if (!emailSent) {
      await prisma.user.delete({ where: { id: newUser.id } })
      return NextResponse.json(
        { error: 'Kunde inte skicka e-post med lösenordslänk. Kontot skapades inte.' },
        { status: 500 }
      )
    }
  }

  await logAudit({
    action: 'EMPLOYEE_CREATE',
    actor: { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    targetType: 'User',
    targetId: newUser.id,
    companyId: company.id,
    details: {
      companyName: company.name,
      createdBySuperadmin: true,
      role: targetRole,
      setupMethod,
    },
    request,
  })

  return NextResponse.json(
    {
      message:
        setupMethod === 'EMAIL_LINK'
          ? 'Konto skapat och inbjudan skickad via e-post'
          : 'Konto skapat med lösenord',
      employee: newUser,
      loginHint:
        setupMethod === 'ADMIN_PASSWORD'
          ? {
              email: newUser.email,
              passwordSet: true,
              loginType: targetRole === 'PAYROLL_COORDINATOR' ? 'admin' : 'employee',
            }
          : null,
    },
    { status: 201 }
  )
}
