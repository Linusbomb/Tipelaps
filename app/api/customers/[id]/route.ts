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

    const normalizedOrgNumber =
      organizationNumber === undefined || organizationNumber === null || organizationNumber === ''
        ? null
        : String(organizationNumber).trim()
    if (normalizedOrgNumber) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          companyId,
          organizationNumber: normalizedOrgNumber,
          NOT: { id: params.id },
        },
        select: { id: true, name: true },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `Kund med org.nr finns redan: ${duplicate.name}` },
          { status: 409 }
        )
      }
    }

    // Uppdatera kunden
    const updateData: any = {
      name: name || existingCustomer.name,
    }

    // Hantera organizationNumber - konvertera tom sträng till null
    if (organizationNumber !== undefined) {
      updateData.organizationNumber = normalizedOrgNumber
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

export async function PATCH(
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

    const body = await request.json().catch(() => ({}))
    const archive = body?.active === true ? false : body?.archive !== false

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    })
    if (!existingCustomer || existingCustomer.companyId !== companyId) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: { archivedAt: archive ? new Date() : null },
    })

    return NextResponse.json(customer)
  } catch (error: any) {
    console.error('Fel vid arkivering av kund:', error)
    return NextResponse.json(
      { error: 'Kunde inte uppdatera kundstatus' },
      { status: 500 }
    )
  }
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

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true, name: true },
    })
    if (!existingCustomer || existingCustomer.companyId !== companyId) {
      return NextResponse.json({ error: 'Kund hittades inte' }, { status: 404 })
    }

    const [timeReportsCount, projectsCount] = await Promise.all([
      prisma.timeReport.count({ where: { customerId: params.id } }),
      prisma.project.count({ where: { customerId: params.id } }),
    ])
    if (timeReportsCount > 0 || projectsCount > 0) {
      return NextResponse.json(
        { error: 'Kunden kan inte raderas eftersom den har tidrapporter eller projekt.' },
        { status: 409 }
      )
    }

    await prisma.customer.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Fel vid radering av kund:', error)
    return NextResponse.json(
      { error: 'Kunde inte radera kund' },
      { status: 500 }
    )
  }
}
