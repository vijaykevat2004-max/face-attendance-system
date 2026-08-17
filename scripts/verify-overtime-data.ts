import { PrismaClient } from '@prisma/client'

async function main() {
  const db = new PrismaClient()
  try {
    const totalAtt = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "Attendance"`
    const overtimeAtt = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "Attendance" WHERE "overtimeHours" > 0`
    const sumOvertimeHours = await db.$queryRaw`SELECT COALESCE(SUM("overtimeHours"), 0)::float as total FROM "Attendance"`
    const sumOvertimePay = await db.$queryRaw`SELECT COALESCE(SUM("overtimePay"), 0)::float as total FROM "Attendance"`
    const totalPayroll = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "PayrollLineItem"`
    const overtimePayroll = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "PayrollLineItem" WHERE "totalOvertimePay" > 0`
    const sumTotalOvertimePay = await db.$queryRaw`SELECT COALESCE(SUM("totalOvertimePay"), 0)::float as total FROM "PayrollLineItem"`

    console.log('=== Overtime Data Verification ===')
    console.log('Total Attendance rows:', (totalAtt as any)[0].count)
    console.log('Attendance rows with overtimeHours > 0:', (overtimeAtt as any)[0].count)
    console.log('Sum of overtimeHours:', (sumOvertimeHours as any)[0].total)
    console.log('Sum of overtimePay (rupees):', (sumOvertimePay as any)[0].total)
    console.log('Total PayrollLineItem rows:', (totalPayroll as any)[0].count)
    console.log('PayrollLineItem rows with totalOvertimePay > 0:', (overtimePayroll as any)[0].count)
    console.log('Sum of totalOvertimePay (rupees):', (sumTotalOvertimePay as any)[0].total)
    console.log('=== End Verification ===')
  } finally {
    await db.$disconnect()
  }
}
main().catch(console.error)
