import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const attendance = await db.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Attendance' ORDER BY ordinal_position`
  console.log('Attendance columns:', JSON.stringify(attendance, null, 2))

  const payroll = await db.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'PayrollLineItem' ORDER BY ordinal_position`
  console.log('PayrollLineItem columns:', JSON.stringify(payroll, null, 2))

  const employee = await db.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Employee' ORDER BY ordinal_position`
  console.log('Employee columns:', JSON.stringify(employee, null, 2))

  const attendanceCount = await db.$queryRaw`SELECT COUNT(*) as count FROM "Attendance"`
  console.log('Attendance row count:', JSON.stringify(attendanceCount))

  const payrollCount = await db.$queryRaw`SELECT COUNT(*) as count FROM "PayrollLineItem"`
  console.log('PayrollLineItem row count:', JSON.stringify(payrollCount))

  await db.$disconnect()
}

main().catch(console.error)
