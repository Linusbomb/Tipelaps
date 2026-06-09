import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { VEHICLE_TYPES } from '@/lib/companyVehicles'

export const dynamic = 'force-dynamic'

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  if (!decoded) return null

  return prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { company: true, ownedCompany: true },
  })
}

function requireAdmin(user: { role: string }) {
  return user.role === 'ENTREPRENEUR' || user.role === 'PAYROLL_COORDINATOR'
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

    const vehicle = await prisma.companyVehicle.findUnique({
      where: { id: params.id },
    })

    if (!vehicle || vehicle.companyId !== companyId) {
      return NextResponse.json({ error: 'Fordon hittades inte' }, { status: 404 })
    }

    return NextResponse.json(vehicle)
  } catch (error: unknown) {
    console.error('Fel vid hämtning av fordon:', error)
    return NextResponse.json({ error: 'Kunde inte hämta fordon' }, { status: 500 })
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
    if (!requireAdmin(user)) {
      return NextResponse.json({ error: 'Endast administratörer kan redigera fordon' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const existing = await prisma.companyVehicle.findUnique({ where: { id: params.id } })
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Fordon hittades inte' }, { status: 404 })
    }
    if (existing.deletedAt) {
      return NextResponse.json(
        { error: 'Raderat fordon kan inte redigeras. Återställ fordonet först.' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const { name, type, registrationNumber, equipment } = body

    const normalizedType = type ? String(type).trim().toUpperCase() : existing.type
    if (!VEHICLE_TYPES.some((item) => item.value === normalizedType)) {
      return NextResponse.json({ error: 'Ogiltig fordonstyp' }, { status: 400 })
    }

    const normalizedReg = registrationNumber
      ? String(registrationNumber).trim().toUpperCase()
      : existing.registrationNumber

    const duplicate = await prisma.companyVehicle.findFirst({
      where: {
        companyId,
        registrationNumber: normalizedReg,
        deletedAt: null,
        NOT: { id: params.id },
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: `Fordon med reg.nr ${normalizedReg} finns redan i registret.` },
        { status: 409 }
      )
    }

    const vehicle = await prisma.companyVehicle.update({
      where: { id: params.id },
      data: {
        type: normalizedType,
        registrationNumber: normalizedReg,
        name:
          name === undefined
            ? existing.name
            : name === null || name === ''
              ? null
              : String(name).trim(),
        equipment:
          equipment === undefined
            ? existing.equipment
            : equipment === null || equipment === ''
              ? null
              : String(equipment).trim(),
      },
    })

    return NextResponse.json(vehicle)
  } catch (error: unknown) {
    console.error('Fel vid uppdatering av fordon:', error)
    return NextResponse.json({ error: 'Kunde inte uppdatera fordon' }, { status: 500 })
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
    if (!requireAdmin(user)) {
      return NextResponse.json({ error: 'Endast administratörer kan ändra fordon' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const restore = body?.restore === true
    const archive = body?.active === true ? false : body?.archive !== false

    const existing = await prisma.companyVehicle.findUnique({ where: { id: params.id } })
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Fordon hittades inte' }, { status: 404 })
    }

    if (restore) {
      const vehicle = await prisma.companyVehicle.update({
        where: { id: params.id },
        data: { deletedAt: null, archivedAt: null },
      })
      return NextResponse.json(vehicle)
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: 'Raderat fordon kan inte ändras. Återställ fordonet först.' },
        { status: 409 }
      )
    }

    const vehicle = await prisma.companyVehicle.update({
      where: { id: params.id },
      data: { archivedAt: archive ? new Date() : null },
    })

    return NextResponse.json(vehicle)
  } catch (error: unknown) {
    console.error('Fel vid arkivering av fordon:', error)
    return NextResponse.json({ error: 'Kunde inte uppdatera fordonstatus' }, { status: 500 })
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
    if (!requireAdmin(user)) {
      return NextResponse.json({ error: 'Endast administratörer kan radera fordon' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const existing = await prisma.companyVehicle.findUnique({
      where: { id: params.id },
      select: { id: true, companyId: true, deletedAt: true },
    })
    if (!existing || existing.companyId !== companyId) {
      return NextResponse.json({ error: 'Fordon hittades inte' }, { status: 404 })
    }
    if (existing.deletedAt) {
      return NextResponse.json({ error: 'Fordonet är redan raderat.' }, { status: 409 })
    }

    const vehicle = await prisma.companyVehicle.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json(vehicle)
  } catch (error: unknown) {
    console.error('Fel vid radering av fordon:', error)
    return NextResponse.json({ error: 'Kunde inte radera fordon' }, { status: 500 })
  }
}
