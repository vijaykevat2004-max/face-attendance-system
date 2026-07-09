// Seed demo data: insert test employees + attendance records so dashboards/reports have content.
// Run with: bun run scripts/seed-demo.ts
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { getLocalDateString, evaluateDay, DEFAULT_SHIFT, type ShiftSettings, type LateTier } from '../src/lib/salary'

async function main() {
  // Default admin (if missing)
  if ((await db.admin.count()) === 0) {
    await db.admin.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        name: 'System Administrator',
      },
    })
    console.log('Created default admin')
  }

  // Settings
  const settingsDefaults: Record<string, string> = {
    shiftStart: DEFAULT_SHIFT.shiftStart,
    shiftEnd: DEFAULT_SHIFT.shiftEnd,
    halfDayAfterMinutes: String(DEFAULT_SHIFT.halfDayAfterMinutes),
    absentAfterMinutes: String(DEFAULT_SHIFT.absentAfterMinutes),
    standardWorkingHours: String(DEFAULT_SHIFT.standardWorkingHours),
    companyName: 'Acme Workshop',
  }
  for (const [k, v] of Object.entries(settingsDefaults)) {
    await db.setting.upsert({ where: { key: k }, update: {}, create: { key: k, value: v } })
  }

  // Rules
  if ((await db.attendanceRule.count()) === 0) {
    await db.attendanceRule.createMany({
      data: [
        { name: 'On Time', kind: 'LATE_TIER', minutesAfter: 0, deduction: 0, active: true },
        { name: 'Late 15m', kind: 'LATE_TIER', minutesAfter: 15, deduction: 100, active: true },
        { name: 'Late 30m', kind: 'LATE_TIER', minutesAfter: 30, deduction: 200, active: true },
        { name: 'Late 60m', kind: 'LATE_TIER', minutesAfter: 60, deduction: 500, active: true },
      ],
    })
  }

  // Demo employees with fake 128-d descriptors
  const demoEmployees = [
    { employeeId: 'EMP-001', name: 'Arjun Sharma', department: 'Production', position: 'Supervisor', baseSalary: 25000 },
    { employeeId: 'EMP-002', name: 'Priya Patel', department: 'Quality', position: 'Inspector', baseSalary: 18000 },
    { employeeId: 'EMP-003', name: 'Rajesh Kumar', department: 'Production', position: 'Operator', baseSalary: 15000 },
    { employeeId: 'EMP-004', name: 'Sunita Reddy', department: 'Packaging', position: 'Helper', baseSalary: 12000 },
    { employeeId: 'EMP-005', name: 'Mohammed Iqbal', department: 'Logistics', position: 'Driver', baseSalary: 16000 },
    { employeeId: 'EMP-006', name: 'Lakshmi Nair', department: 'Admin', position: 'Clerk', baseSalary: 20000 },
    { employeeId: 'EMP-007', name: 'Vikram Singh', department: 'Production', position: 'Operator', baseSalary: 15000 },
    { employeeId: 'EMP-008', name: 'Anjali Gupta', department: 'Quality', position: 'Inspector', baseSalary: 18000 },
  ]

  const fakeDescriptor = JSON.stringify(Array.from({ length: 128 }, () => Math.random() * 2 - 1))

  for (const e of demoEmployees) {
    const existing = await db.employee.findUnique({ where: { employeeId: e.employeeId } })
    if (existing) continue
    await db.employee.create({
      data: {
        ...e,
        email: `${e.name.toLowerCase().replace(/\s+/g, '.')}@acme.in`,
        phone: '+91 98765 ' + Math.floor(10000 + Math.random() * 89999),
        faceDescriptor: fakeDescriptor,
        faceImage: null,
        active: true,
      },
    })
  }
  console.log(`Seeded ${demoEmployees.length} demo employees`)

  // Generate attendance for last 25 days (excluding Sundays)
  const rules = await db.attendanceRule.findMany({ where: { kind: 'LATE_TIER', active: true } })
  const tiers: LateTier[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    minutesAfter: r.minutesAfter,
    deduction: r.deduction,
  }))

  const shift: ShiftSettings = DEFAULT_SHIFT
  const employees = await db.employee.findMany({ where: { active: true } })

  const today = new Date()
  let created = 0
  for (let i = 25; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (d.getDay() === 0) continue // skip Sunday

    const dateStr = getLocalDateString(d)
    const workingDaysInMonth = (() => {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const daysInMonth = new Date(y, m, 0).getDate()
      let wd = 0
      for (let dd = 1; dd <= daysInMonth; dd++) {
        if (new Date(y, m - 1, dd).getDay() !== 0) wd++
      }
      return wd
    })()

    for (const emp of employees) {
      // Random: 85% present, 10% late, 3% half-day, 2% absent
      const r = Math.random()
      let checkIn: Date | null = new Date(d)
      let checkOut: Date | null = new Date(d)
      let status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT'

      if (r < 0.02) {
        // Absent
        checkIn = null
        checkOut = null
        status = 'ABSENT'
      } else if (r < 0.05) {
        // Half day - arrive at 13:00
        checkIn.setHours(13, 0, 0, 0)
        checkOut.setHours(17, Math.floor(Math.random() * 60), 0, 0)
        status = 'HALF_DAY'
      } else if (r < 0.15) {
        // Late - arrive between 09:15 and 10:30
        const lateMin = 15 + Math.floor(Math.random() * 75)
        checkIn.setHours(9, 0, 0, 0)
        checkIn.setMinutes(lateMin)
        checkOut.setHours(18, Math.floor(Math.random() * 30), 0, 0)
        status = 'LATE'
      } else {
        // Present - arrive 08:40 to 09:05
        const earlyMin = -20 + Math.floor(Math.random() * 25)
        checkIn.setHours(9, 0, 0, 0)
        checkIn.setMinutes(earlyMin)
        checkOut.setHours(18, Math.floor(Math.random() * 30), 0, 0)
        status = 'PRESENT'
      }

      const dailyWage = emp.baseSalary / workingDaysInMonth
      const result = evaluateDay(checkIn, checkOut, shift, tiers, dailyWage)

      // Skip if already exists
      const existing = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
      })
      if (existing) continue

      await db.attendance.create({
        data: {
          employeeId: emp.id,
          date: dateStr,
          checkIn: checkIn,
          checkOut: checkOut,
          status: result.status,
          lateMinutes: result.lateMinutes,
          workingHours: result.workingHours,
          deduction: result.deduction,
          note: result.note,
        },
      })
      created++
    }
  }
  console.log(`Seeded ${created} attendance records`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
