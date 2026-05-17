import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

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
    include: { company: true, ownedCompany: true },
  })

  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const company = user.ownedCompany || user.company
    if (
      !company ||
      (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR')
    ) {
      return NextResponse.json(
        { error: 'Endast admin kan ladda upp företagslogga' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil vald' }, { status: 400 })
    }

    // Validera filtyp
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Endast bildfiler (PNG, JPG, GIF, SVG) är tillåtna' }, { status: 400 })
    }

    // Validera filstorlek (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Filen är för stor. Max storlek är 5MB' }, { status: 400 })
    }

    // Skapa uploads-katalog om den inte finns
    const uploadsDir = join(process.cwd(), 'uploads', 'logos')
    await mkdir(uploadsDir, { recursive: true })

    // Ta bort gammal logga om den finns
    if (company.logoPath) {
      try {
        const oldLogoPath = join(process.cwd(), company.logoPath)
        await import('fs/promises').then(fs => fs.unlink(oldLogoPath).catch(() => {}))
      } catch (error) {
        // Ignorera om filen inte finns
      }
    }

    // Generera unikt filnamn
    const fileExtension = file.name.split('.').pop()
    const fileName = `logo-${company.id}-${Date.now()}.${fileExtension}`
    const filePath = join(uploadsDir, fileName)
    const relativePath = `uploads/logos/${fileName}`

    // Spara filen
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Uppdatera företaget med ny logga-sökväg
    await prisma.company.update({
      where: { id: company.id },
      data: { logoPath: relativePath },
    })

    return NextResponse.json({
      message: 'Logga uppladdad',
      logoPath: relativePath,
    })
  } catch (error: any) {
    console.error('Fel vid uppladdning av logga:', error)
    return NextResponse.json(
      { error: 'Kunde inte ladda upp logga' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ logoPath: null, companyCreatedAt: null })
    }

    const company = user.ownedCompany || user.company
    if (!company) {
      return NextResponse.json({ logoPath: null, companyCreatedAt: null })
    }

    return NextResponse.json({
      logoPath: company.logoPath || null,
      companyCreatedAt: company.createdAt,
    })
  } catch (error: any) {
    console.error('Fel vid hämtning av logga:', error)
    return NextResponse.json({ logoPath: null, companyCreatedAt: null })
  }
}
