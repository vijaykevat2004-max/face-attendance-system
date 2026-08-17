import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
;(async () => {
  const e = await db.employee.findFirst()
  console.log(JSON.stringify(e, null, 2))
  await db.$disconnect()
})()