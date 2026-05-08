import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const superAdmin = await requireSuperAdmin(request)
  if (!superAdmin) {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const newPassword = typeof body?.password === 'string' ? body.password : ''
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: 'Lösenord måste vara minst 6 tecken' },
      { status: 400 }
    )
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { ownerId: true },
  })
  if (!company) {
    return NextResponse.json({ error: 'Företag hittades inte' }, { status: 404 })
  }

  const hashed = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: company.ownerId },
    data: { password: hashed, passwordResetToken: null, passwordResetExpires: null },
  })

  return NextResponse.json({ message: 'Lösenord uppdaterat' })
}
