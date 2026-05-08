/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ['super@admin.se', 'demo@admin.se', 'demo@personal.se'] },
    },
    select: { email: true, role: true, companyId: true, createdAt: true },
    orderBy: { email: 'asc' },
  })
  const auditCount = await prisma.auditLog.count()
  console.log('Users on this DB:')
  console.table(users)
  console.log('AuditLog rows:', auditCount)
  await prisma.$disconnect()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
