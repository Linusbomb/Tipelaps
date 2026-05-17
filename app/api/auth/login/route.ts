import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import {
  checkLoginRateLimit,
  getRequestIp,
  notifyIfNewDeviceForAdmin,
} from '@/lib/securityAlerts'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, loginType } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-post och lösenord krävs' },
        { status: 400 }
      )
    }

    const ipAddress = getRequestIp(request.headers)

    const rate = await checkLoginRateLimit(String(email).toLowerCase(), ipAddress)
    if (!rate.allowed) {
      await logAudit({
        action: 'LOGIN_FAILURE',
        actor: { email: String(email) },
        details: { reason: 'rate_limited', kind: rate.reason },
        request,
      })
      return NextResponse.json(
        {
          error:
            rate.reason === 'email'
              ? 'För många misslyckade försök på detta konto. Vänta några minuter eller återställ lösenordet.'
              : 'För många misslyckade försök från din IP. Vänta några minuter och försök igen.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    })

    if (!user) {
      await logAudit({
        action: 'LOGIN_FAILURE',
        actor: { email: String(email) },
        details: { reason: 'unknown_user', loginType: loginType ?? null },
        request,
      })
      return NextResponse.json(
        { error: 'Fel e-post eller lösenord' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      await logAudit({
        action: 'LOGIN_FAILURE',
        actor: { id: user.id, email: user.email, role: user.role },
        companyId: user.companyId,
        details: { reason: 'wrong_password', loginType: loginType ?? null },
        request,
      })
      return NextResponse.json(
        { error: 'Fel e-post eller lösenord' },
        { status: 401 }
      )
    }

    if (user.employmentEndedAt != null) {
      await logAudit({
        action: 'LOGIN_BLOCKED_ENDED',
        actor: { id: user.id, email: user.email, role: user.role },
        companyId: user.companyId,
        request,
      })
      return NextResponse.json(
        {
          error:
            'Detta arbetskonto är avslutat och kan inte användas. Be din arbetsgivare skapa ett nytt konto om du återvänder.',
        },
        { status: 403 }
      )
    }

    const isSuperAdmin = user.role === 'SUPERADMIN'
    const isAdminUser =
      isSuperAdmin || user.role === 'ENTREPRENEUR' || user.role === 'PAYROLL_COORDINATOR'
    if (loginType === 'admin' && !isAdminUser) {
      await logAudit({
        action: 'LOGIN_WRONG_LOGIN_TYPE',
        actor: { id: user.id, email: user.email, role: user.role },
        companyId: user.companyId,
        details: { loginType },
        request,
      })
      return NextResponse.json(
        { error: 'Detta konto är Personal. Logga in via Personal-rutan istället.' },
        { status: 403 }
      )
    }
    if (loginType === 'employee' && isAdminUser) {
      await logAudit({
        action: 'LOGIN_WRONG_LOGIN_TYPE',
        actor: { id: user.id, email: user.email, role: user.role },
        companyId: user.companyId,
        details: { loginType },
        request,
      })
      return NextResponse.json(
        { error: 'Detta konto är Admin. Logga in via Admin-rutan istället.' },
        { status: 403 }
      )
    }

    const token = generateToken(user.id, user.email, user.role)

    await logAudit({
      action: 'LOGIN_SUCCESS',
      actor: { id: user.id, email: user.email, role: user.role },
      companyId: user.companyId,
      details: { loginType: loginType ?? null },
      request,
    })

    // Skicka varning vid ny enhet/IP för admin/superadmin (best-effort, swallowing)
    void notifyIfNewDeviceForAdmin({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    }).catch((err) => console.error('notifyIfNewDeviceForAdmin failed:', err))

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    })
  } catch (error: any) {
    console.error('Inloggningsfel:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    )
  }
}
