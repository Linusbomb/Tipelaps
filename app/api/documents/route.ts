import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Kontrollera behörighet
    if (userId && userId !== user.id) {
      // Om det är en annan användare, kontrollera om det är chef/lönesamordnare
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      // Kontrollera att användaren tillhör samma företag
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!targetUser || targetUser.companyId !== user.companyId) {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }
    }

    const where: any = {}
    if (userId) {
      where.userId = userId
    } else {
      where.userId = user.id
    }

    const documents = await prisma.employeeDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error: any) {
    console.error('Fel vid hämtning av dokument:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta dokument' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string
    const title = formData.get('title') as string
    const userId = formData.get('userId') as string
    const expiryDate = formData.get('expiryDate') as string
    const issuedDate = formData.get('issuedDate') as string
    const description = formData.get('description') as string

    if (!file || !type || !title || !userId) {
      return NextResponse.json(
        { error: 'Fil, typ, titel och användar-ID krävs' },
        { status: 400 }
      )
    }

    // Kontrollera behörighet
    if (userId !== user.id) {
      if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!targetUser || targetUser.companyId !== user.companyId) {
        return NextResponse.json({ error: 'Ej behörig' }, { status: 403 })
      }
    }

    // Skapa uploads-mapp om den inte finns
    const uploadsDir = join(process.cwd(), 'uploads', userId)
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generera unikt filnamn
    const timestamp = Date.now()
    const originalName = file.name
    const extension = originalName.split('.').pop()
    const fileName = `${timestamp}-${originalName}`
    const filePath = join(uploadsDir, fileName)

    // Spara filen
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Spara dokument i databasen
    const document = await prisma.employeeDocument.create({
      data: {
        userId,
        type: type as any,
        title,
        fileName: originalName,
        filePath: `uploads/${userId}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        description: description || null,
        uploadedBy: user.id,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error: any) {
    console.error('Fel vid uppladdning av dokument:', error)
    return NextResponse.json(
      { error: 'Kunde inte ladda upp dokument' },
      { status: 500 }
    )
  }
}
