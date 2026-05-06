import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { writeFile, mkdir, unlink } from 'fs/promises'
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const user = await prisma.user.findUnique({
      where: { id },
      select: { profileImagePath: true },
    })

    if (!user || !user.profileImagePath) {
      return new NextResponse('Ingen profilbild', { status: 404 })
    }

    const filePath = join(process.cwd(), user.profileImagePath)
    if (!existsSync(filePath)) {
      return new NextResponse('Bild hittades inte', { status: 404 })
    }

    const { readFile } = await import('fs/promises')
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
      },
    })
  } catch (error: any) {
    console.error('Fel vid hämtning av profilbild:', error)
    return new NextResponse('Kunde inte hämta profilbild', { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { id } = params

    // Kontrollera behörighet
    if (id !== user.id) {
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
      })

      if (!targetUser || targetUser.companyId !== user.companyId) {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }
    }

    const formData = await request.formData()
    const file = formData.get('profileImage') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Ingen fil angiven' },
        { status: 400 }
      )
    }

    // Kontrollera att det är en bild
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Filen måste vara en bild' },
        { status: 400 }
      )
    }

    // Ta bort gamla profilbild om den finns
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { profileImagePath: true },
    })

    if (targetUser?.profileImagePath) {
      const oldFilePath = join(process.cwd(), targetUser.profileImagePath)
      if (existsSync(oldFilePath)) {
        await unlink(oldFilePath)
      }
    }

    // Skapa uploads/profiles-mapp om den inte finns
    const uploadsDir = join(process.cwd(), 'uploads', 'profiles')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generera unikt filnamn
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const fileName = `${id}-${timestamp}.${extension}`
    const filePath = join(uploadsDir, fileName)

    // Spara filen
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Uppdatera användaren i databasen
    await prisma.user.update({
      where: { id },
      data: {
        profileImagePath: `uploads/profiles/${fileName}`,
      },
    })

    return NextResponse.json({ message: 'Profilbild uppladdad', path: `uploads/profiles/${fileName}` })
  } catch (error: any) {
    console.error('Fel vid uppladdning av profilbild:', error)
    return NextResponse.json(
      { error: 'Kunde inte ladda upp profilbild' },
      { status: 500 }
    )
  }
}
