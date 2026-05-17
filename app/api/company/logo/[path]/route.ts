import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string } }
) {
  try {
    const logoPath = decodeURIComponent(params.path)
    const fullPath = join(process.cwd(), logoPath)

    // SÃ¤kerhetskontroll - bara tillÃ¥t filer i uploads/logos
    if (!logoPath.startsWith('uploads/logos/')) {
      return NextResponse.json({ error: 'Ogiltig sÃ¶kvÃ¤g' }, { status: 403 })
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Logotyp hittades inte' }, { status: 404 })
    }

    const file = await readFile(fullPath)
    const ext = logoPath.split('.').pop()?.toLowerCase()
    
    let contentType = 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
    if (ext === 'gif') contentType = 'image/gif'
    if (ext === 'svg') contentType = 'image/svg+xml'

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error: any) {
    console.error('Fel vid hÃ¤mtning av logotyp:', error)
    return NextResponse.json({ error: 'Kunde inte hÃ¤mta logotyp' }, { status: 500 })
  }
}