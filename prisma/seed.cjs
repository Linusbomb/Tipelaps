/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const SUPERADMIN_EMAIL = 'super@admin.se'
const ADMIN_EMAIL = 'demo@admin.se'
const EMPLOYEE_EMAIL = 'demo@personal.se'
const DEFAULT_PASSWORD = 'demo123'

async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

async function ensureSuperAdmin(hashed) {
  const existing = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL } })
  if (existing) {
    if (existing.role !== 'SUPERADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'SUPERADMIN', companyId: null },
      })
      console.log('SUPERADMIN-roll satt på', SUPERADMIN_EMAIL)
    } else {
      console.log('SUPERADMIN finns redan:', SUPERADMIN_EMAIL)
    }
    return
  }
  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: SUPERADMIN_EMAIL,
      password: hashed,
      role: 'SUPERADMIN',
    },
  })
  console.log('SUPERADMIN skapad:', SUPERADMIN_EMAIL)
}

async function ensureDemoCompany(hashed) {
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existingAdmin) {
    console.log('Demo-företag finns redan (admin:', ADMIN_EMAIL, ')')
    return
  }

  const admin = await prisma.user.create({
    data: {
      name: 'Demo Admin',
      email: ADMIN_EMAIL,
      password: hashed,
      role: 'ENTREPRENEUR',
    },
  })

  const company = await prisma.company.create({
    data: {
      name: 'Demo Bygg AB',
      ownerId: admin.id,
    },
  })

  await prisma.user.update({
    where: { id: admin.id },
    data: { companyId: company.id },
  })

  await prisma.user.create({
    data: {
      name: 'Demo Personal',
      email: EMPLOYEE_EMAIL,
      password: hashed,
      role: 'EMPLOYEE',
      companyId: company.id,
    },
  })
  console.log('Demo-företag och konton skapade.')
}

async function main() {
  const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD
  const hashed = await hashPassword(password)

  await ensureSuperAdmin(hashed)
  await ensureDemoCompany(hashed)

  console.log('')
  console.log('Seed klart. Konton (lösenord:', password + '):')
  console.log('  Superadmin:', SUPERADMIN_EMAIL)
  console.log('  Kund-admin:', ADMIN_EMAIL)
  console.log('  Personal:  ', EMPLOYEE_EMAIL)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
