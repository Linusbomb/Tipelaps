import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
    })

    if (!customer || customer.companyId !== companyId) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error: any) {
    console.error('Fel vid hämtning av kund:', error)
    return NextResponse.json(
      { error: 'Kunde inte hämta kund' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json()
    const { name, organizationNumber, address, information, contactEmail } = body

    // Kontrollera att kunden finns och tillhör samma företag
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    })

    if (!existingCustomer || existingCustomer.companyId !== companyId) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    // Uppdatera kunden
    const updateData: any = {
      name: name || existingCustomer.name,
    }

    // Hantera organizationNumber - konvertera tom sträng till null
    if (organizationNumber !== undefined) {
      updateData.organizationNumber = organizationNumber === '' ? null : organizationNumber
    } else {
      updateData.organizationNumber = existingCustomer.organizationNumber
    }

    // Hantera address - konvertera tom sträng till null
    if (address !== undefined) {
      updateData.address = address === '' ? null : address
    } else {
      updateData.address = existingCustomer.address
    }

    // Hantera information - konvertera tom sträng till null
    if (information !== undefined) {
      updateData.information = information === '' ? null : information
    } else {
      updateData.information = existingCustomer.information
    }

    if (contactEmail !== undefined) {
      updateData.contactEmail = contactEmail === '' ? null : String(contactEmail).trim()
    } else {
      updateData.contactEmail = existingCustomer.contactEmail
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(customer)
  } catch (error: any) {
    console.error('Fel vid uppdatering av kund:', error)
    console.error('Felmeddelande:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { error: 'Kunde inte uppdatera kund', details: error.message },
      { status: 500 }
    )
  }
}
