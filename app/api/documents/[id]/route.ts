import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'
import { existsSync } from 'fs'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true },
  })

  return user
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { id } = params

    const document = await prisma.employeeDocument.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Dokument hittades inte' }, { status: 404 })
    }

    // Kontrollera behörighet
    if (document.userId !== user.id) {
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      if (document.user.companyId !== user.companyId) {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }
    }

    // Ta bort filen
    const filePath = join(process.cwd(), document.filePath)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    // Ta bort från databasen
    await prisma.employeeDocument.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Dokument borttaget' })
  } catch (error: any) {
    console.error('Fel vid borttagning av dokument:', error)
    return NextResponse.json(
      { error: 'Kunde inte ta bort dokument' },
      { status: 500 }
    )
  }
}
