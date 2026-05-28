import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null
  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) return NextResponse.json({ error: 'Företag saknas' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const timeReportId = searchParams.get('timeReportId')

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (timeReportId) where.timeReportId = timeReportId

    const attachments = await prisma.projectAttachment.findMany({
      where,
      include: {
        project: { select: { id: true, companyId: true, name: true } },
        timeReport: { select: { id: true, user: { select: { companyId: true } } } },
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const filtered = attachments.filter((item) => {
      if (item.project?.companyId === companyId) return true
      if (!item.project && item.timeReport?.user?.companyId === companyId) return true
      return false
    })

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Fel vid hämtning av bilagor:', error)
    return NextResponse.json({ error: 'Kunde inte hämta bilagor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) return NextResponse.json({ error: 'Företag saknas' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = (formData.get('projectId') as string | null) || null
    const timeReportId = (formData.get('timeReportId') as string | null) || null

    if (!file) return NextResponse.json({ error: 'Ingen fil vald' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Endast bilder tillåts' }, { status: 400 })
    }

    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, companyId: true },
      })
      if (!project || project.companyId !== companyId) {
        return NextResponse.json({ error: 'Projekt hittades inte' }, { status: 404 })
      }
    }

    if (timeReportId) {
      const report = await prisma.timeReport.findUnique({
        where: { id: timeReportId },
        include: { user: true },
      })
      if (!report) return NextResponse.json({ error: 'Tidrapport hittades inte' }, { status: 404 })
      if (report.user.companyId !== companyId) {
        return NextResponse.json({ error: 'Ej behörig för rapporten' }, { status: 403 })
      }
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'project-attachments')
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true })

    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const fileName = `${Date.now()}-${safeName}`
    const fullPath = join(uploadsDir, fileName)
    const bytes = await file.arrayBuffer()
    await writeFile(fullPath, Buffer.from(bytes))

    const attachment = await prisma.projectAttachment.create({
      data: {
        projectId,
        timeReportId,
        uploadedBy: user.id,
        fileName: file.name,
        filePath: `uploads/project-attachments/${fileName}`,
        mimeType: file.type || 'image/jpeg',
        fileSize: file.size,
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Fel vid uppladdning av bilaga:', error)
    return NextResponse.json({ error: 'Kunde inte ladda upp bilaga' }, { status: 500 })
  }
}
