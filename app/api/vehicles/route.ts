import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { adminEffectiveCompanyId } from '@/lib/apiAdmin'
import { VEHICLE_TYPES } from '@/lib/companyVehicles'

export const dynamic = 'force-dynamic'

function vehicleApiErrorMessage(error: unknown, action: string) {
  const message = error instanceof Error ? error.message : ''
  if (
    message.includes("Cannot read properties of undefined (reading 'findFirst')") ||
    message.includes("Cannot read properties of undefined (reading 'findMany')") ||
    message.includes("Cannot read properties of undefined (reading 'create')")
  ) {
    return `Fordonsregistret är inte laddat. Stoppa dev-servern, kör npx prisma generate och starta om (npx prisma migrate deploy i produktion).`
  }
  if (message.includes('CompanyVehicle') && message.includes('does not exist')) {
    return 'Databasen saknar fordonsregistret. Kör npx prisma migrate deploy och starta om appen.'
  }
  if (message) return `Kunde inte ${action}: ${message}`
  return `Kunde inte ${action}`
}

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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    const vehicles = await prisma.companyVehicle.findMany({
      where: {
        companyId,
        ...(activeOnly ? { archivedAt: null, deletedAt: null } : {}),
        ...(!activeOnly && !includeDeleted ? { deletedAt: null } : {}),
      },
      orderBy: [{ type: 'asc' }, { registrationNumber: 'asc' }],
    })

    return NextResponse.json(vehicles)
  } catch (error: unknown) {
    console.error('Fel vid hämtning av fordon:', error)
    return NextResponse.json({ error: vehicleApiErrorMessage(error, 'hämta fordon') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Ej auktoriserad' }, { status: 401 })
    }

    if (user.role !== 'ENTREPRENEUR' && user.role !== 'PAYROLL_COORDINATOR') {
      return NextResponse.json({ error: 'Endast administratörer kan registrera fordon' }, { status: 403 })
    }

    const companyId = adminEffectiveCompanyId(user)
    if (!companyId) {
      return NextResponse.json({ error: 'Du måste tillhöra ett företag' }, { status: 400 })
    }

    const body = await request.json()
    const { name, type, registrationNumber, equipment } = body

    if (!type || !registrationNumber) {
      return NextResponse.json({ error: 'Fordonstyp och registreringsnummer krävs' }, { status: 400 })
    }

    const normalizedType = String(type).trim().toUpperCase()
    if (!VEHICLE_TYPES.some((item) => item.value === normalizedType)) {
      return NextResponse.json({ error: 'Ogiltig fordonstyp' }, { status: 400 })
    }

    const normalizedReg = String(registrationNumber).trim().toUpperCase()
    if (!normalizedReg) {
      return NextResponse.json({ error: 'Registreringsnummer krävs' }, { status: 400 })
    }

    const duplicate = await prisma.companyVehicle.findFirst({
      where: { companyId, registrationNumber: normalizedReg, deletedAt: null },
      select: { id: true, name: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: `Fordon med reg.nr ${normalizedReg} finns redan i registret.` },
        { status: 409 }
      )
    }

    const vehicle = await prisma.companyVehicle.create({
      data: {
        companyId,
        type: normalizedType,
        registrationNumber: normalizedReg,
        name:
          name === undefined || name === null || name === ''
            ? null
            : String(name).trim(),
        equipment:
          equipment === undefined || equipment === null || equipment === ''
            ? null
            : String(equipment).trim(),
      },
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error: unknown) {
    console.error('Fel vid skapande av fordon:', error)
    return NextResponse.json({ error: vehicleApiErrorMessage(error, 'skapa fordon') }, { status: 500 })
  }
}
