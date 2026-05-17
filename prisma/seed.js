/**
 * Demo-konton för utveckling / första deploy.
 * Kör: npx prisma db seed
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'demo@admin.se'
const ADMIN_PASSWORD = 'demo123'
const ADMIN_NAME = 'Demo Admin'

const EMPLOYEE_EMAIL = 'demo@personal.se'
const EMPLOYEE_PASSWORD = 'demo123'
const EMPLOYEE_NAME = 'Demo Personal'

const LEGACY_ADMIN_EMAILS = ['admin@lvtech.se', 'Admin@lvtech.se']

async function upsertAdmin(hashedPassword) {
  let user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

  if (!user) {
    for (const legacyEmail of LEGACY_ADMIN_EMAILS) {
      const legacy = await prisma.user.findUnique({ where: { email: legacyEmail } })
      if (legacy) {
        user = await prisma.user.update({
          where: { id: legacy.id },
          data: {
            email: ADMIN_EMAIL,
            password: hashedPassword,
            role: 'ENTREPRENEUR',
            name: ADMIN_NAME,
          },
        })
        break
      }
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: hashedPassword,
        role: 'ENTREPRENEUR',
      },
    })
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        role: 'ENTREPRENEUR',
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
      },
    })
  }

  return user
}

async function upsertEmployee(hashedPassword, companyId) {
  let user = await prisma.user.findUnique({ where: { email: EMPLOYEE_EMAIL } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: EMPLOYEE_EMAIL,
        name: EMPLOYEE_NAME,
        password: hashedPassword,
        role: 'EMPLOYEE',
        companyId,
      },
    })
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        role: 'EMPLOYEE',
        name: EMPLOYEE_NAME,
        companyId,
      },
    })
  }

  return user
}

async function main() {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const employeeHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 10)

  const admin = await upsertAdmin(adminHash)

  const fullAdmin = await prisma.user.findUnique({
    where: { id: admin.id },
    include: { ownedCompany: true },
  })

  if (!fullAdmin) {
    throw new Error('Seed: could not load admin user')
  }

  if (!fullAdmin.ownedCompany) {
    await prisma.company.create({
      data: {
        name: 'LVTECH',
        ownerId: fullAdmin.id,
      },
    })
  }

  const company =
    fullAdmin.ownedCompany ??
    (await prisma.company.findUnique({
      where: { ownerId: fullAdmin.id },
    }))

  if (!company) {
    throw new Error('Seed: could not load company')
  }

  if (fullAdmin.companyId !== company.id) {
    await prisma.user.update({
      where: { id: fullAdmin.id },
      data: { companyId: company.id },
    })
  }

  await upsertEmployee(employeeHash, company.id)

  console.log(`Seed OK: admin ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`Seed OK: personal ${EMPLOYEE_EMAIL} / ${EMPLOYEE_PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
