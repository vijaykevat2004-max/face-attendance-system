import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
;(async () => {
  const e = await db.employee.findUnique({ 
    where: { id: 'cmrborfpc0002lf04gjee2i5h' }, 
    select: { employeeId: true, name: true, active: true, employeePortalEnabled: true, employeePinHash: true, employeeMustChangePin: true, employeeSessionVersion: true } 
  })
  console.log(JSON.stringify(e, null, 2))
  await db.$disconnect()
})()