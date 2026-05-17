import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyToken } from '@/lib/auth'
import { sendSetPasswordEmail } from '@/lib/email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
const VALID_CATEGORIES = ['LASTBILSCHAUFOR', 'MASKINFORARE', 'MARKANLAGGARE', 'TJANSTEMAN']

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

  // Endast entreprenörer och lönesamordnare kan lägga till personal
  if (!user || (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')) {
    return null
  }

  // Hämta företaget (antingen ownedCompany eller company)
  const company = user.ownedCompany || user.company
  if (!company) {
    return null
  }

  return { user, company }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const { company } = auth
    const body = await request.json()
    const { name, email, phone, employeeCategory, role, passwordSetupMethod, password } = body
    const targetRole = role === 'PAYROLL_COORDINATOR' ? 'PAYROLL_COORDINATOR' : 'EMPLOYEE'
    const setupMethod = passwordSetupMethod === 'ADMIN_PASSWORD' ? 'ADMIN_PASSWORD' : 'EMAIL_LINK'

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Namn och e-post krävs' },
        { status: 400 }
      )
    }
    if (employeeCategory && !VALID_CATEGORIES.includes(employeeCategory)) {
      return NextResponse.json(
        { error: 'Ogiltig personalkategori' },
        { status: 400 }
      )
    }
    if (setupMethod === 'ADMIN_PASSWORD' && (!password || String(password).length < 6)) {
      return NextResponse.json(
        { error: 'Lösenord måste vara minst 6 tecken när admin sätter lösenord' },
        { status: 400 }
      )
    }

    // Kontrollera om användaren redan finns
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'En användare med denna e-post finns redan' },
        { status: 400 }
      )
    }

    const passwordToSave =
      setupMethod === 'ADMIN_PASSWORD' ? String(password) : crypto.randomBytes(16).toString('hex')
    const hashedPassword = await hashPassword(passwordToSave)
    const setupToken = setupMethod === 'EMAIL_LINK' ? crypto.randomBytes(32).toString('hex') : null
    const setupExpires = setupMethod === 'EMAIL_LINK' ? new Date() : null
    if (setupExpires) {
      setupExpires.setDate(setupExpires.getDate() + 7)
    }

    // Skapa anställd och koppla till företaget
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        employeeCategory: targetRole === 'EMPLOYEE' && employeeCategory ? employeeCategory : null,
        role: targetRole,
        companyId: company.id,
        passwordResetToken: setupToken || null,
        passwordResetExpires: setupExpires || null,
      },
    })

    if (setupMethod === 'EMAIL_LINK') {
      let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      if (!baseUrl) {
        if (process.env.VERCEL_URL) {
          baseUrl = `https://${process.env.VERCEL_URL}`
        } else {
          baseUrl = 'http://localhost:3000'
        }
      }

      const setupLink = `${baseUrl}/reset-password?token=${setupToken}`
      const emailSent = await sendSetPasswordEmail(email, setupLink, name, auth.user.name)

      if (!emailSent) {
        await prisma.user.delete({ where: { id: newUser.id } })
        return NextResponse.json(
          { error: 'Kunde inte skicka e-post med lösenordslänk. Användaren skapades inte.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      message:
        setupMethod === 'EMAIL_LINK'
          ? targetRole === 'PAYROLL_COORDINATOR'
            ? 'Admin tillagd och e-post skickad'
            : 'Personal tillagd och e-post skickad'
          : targetRole === 'PAYROLL_COORDINATOR'
          ? 'Admin tillagd med lösenord'
          : 'Personal tillagd med lösenord',
      employee: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        employeeCategory: newUser.employeeCategory,
        role: newUser.role,
      },
    })
  } catch (error: any) {
    console.error('Fel vid tillägg av personal:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid tillägg av personal' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const { company } = auth
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim()
    const sort = searchParams.get('sort') || 'name_asc'

    const employees = await prisma.user.findMany({
      where: {
        companyId: company.id,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
        ...(category && category !== 'ALL' ? { employeeCategory: category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
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
      orderBy:
        sort === 'created_desc'
          ? { createdAt: 'desc' }
          : sort === 'created_asc'
          ? { createdAt: 'asc' }
          : sort === 'name_desc'
          ? { name: 'desc' }
          : { name: 'asc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Fel vid hämtning av personal:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid hämtning av personal' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin(request)
    if (!auth) {
      return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
    }

    const { company } = auth
    const body = await request.json()
    const { employeeId, employeeCategory } = body

    if (!employeeId || !employeeCategory) {
      return NextResponse.json(
        { error: 'employeeId och employeeCategory krävs' },
        { status: 400 }
      )
    }
    if (!VALID_CATEGORIES.includes(employeeCategory)) {
      return NextResponse.json(
        { error: 'Ogiltig personalkategori' },
        { status: 400 }
      )
    }

    const employee = await prisma.user.findFirst({
      where: {
        id: employeeId,
        companyId: company.id,
        employmentEndedAt: null,
        role: { in: ['EMPLOYEE', 'PAYROLL_COORDINATOR'] },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Anställd hittades inte' },
        { status: 404 }
      )
    }

    const updatedEmployee = await prisma.user.update({
      where: { id: employeeId },
      data: { employeeCategory },
      select: {
        id: true,
        employeeCategory: true,
        role: true,
      },
    })

    return NextResponse.json({
      message: 'Kategori uppdaterad',
      employee: updatedEmployee,
    })
  } catch (error) {
    console.error('Fel vid uppdatering av personalkategori:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid uppdatering av kategori' },
      { status: 500 }
    )
  }
}
