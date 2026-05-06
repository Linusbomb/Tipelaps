/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'demo@admin.se'
const EMPLOYEE_EMAIL = 'demo@personal.se'
const DEFAULT_PASSWORD = 'demo123'

async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

async function main() {
  const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log('Seed hoppas över: användare finns redan:', ADMIN_EMAIL)
    return
  }

  const hashed = await hashPassword(password)

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

  console.log('')
  console.log('Seed klart. Testkonton:')
  console.log('  Admin:    ', ADMIN_EMAIL)
  console.log('  Personal: ', EMPLOYEE_EMAIL)
  console.log('  Lösenord: ', password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
