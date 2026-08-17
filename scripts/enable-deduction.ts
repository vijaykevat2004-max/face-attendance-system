import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function enableDeduction() {
  await db.setting.upsert({
    where: { key: 'salaryDeductionEnabled' },
    update: { value: 'true' },
    create: { key: 'salaryDeductionEnabled', value: 'true' }
  })
  console.log('salaryDeductionEnabled = true')
  await db.$disconnect()
}

enableDeduction().catch(console.error)