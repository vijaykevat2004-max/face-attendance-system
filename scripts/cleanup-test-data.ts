import { PrismaClient } from '@prisma/client'
import { getISTParts } from '../src/lib/salary'

const db = new PrismaClient()

async function cleanupTestData() {
  const ist = getISTParts()
  const year = ist.year
  const month = ist.month
  const daysInMonth = new Date(year, month, 0).getDate()
  
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  // Delete test attendance
  const deletedAtt = await db.attendance.deleteMany({
    where: { date: { gte: from, lte: to } }
  })
  console.log(`Deleted ${deletedAtt.count} attendance records`)

  // Delete test payroll
  const deletedPayroll = await db.payrollRun.deleteMany({
    where: { month: `${year}-${String(month).padStart(2, '0')}` }
  })
  console.log(`Deleted ${deletedPayroll.count} payroll runs`)

  // Reset salaryDeductionEnabled to false
  await db.setting.upsert({
    where: { key: 'salaryDeductionEnabled' },
    update: { value: 'false' },
    create: { key: 'salaryDeductionEnabled', value: 'false' }
  })
  console.log('Reset salaryDeductionEnabled = false')

  // Reset employee portal PIN fields for test employees
  await db.employee.updateMany({
    where: { id: { in: ['cmrborfpc0002lf04gjee2i5h'] } },
    data: { employeePinHash: null, employeeMustChangePin: true, employeePortalEnabled: false, employeeSessionVersion: 0 }
  })
  console.log('Reset test employee PIN fields')

  await db.$disconnect()
  console.log('\n=== CLEANUP COMPLETE ===')
}

cleanupTestData().catch(console.error)