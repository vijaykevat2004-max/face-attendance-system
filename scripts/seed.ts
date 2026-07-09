// Seed script: creates default admin, attendance rules, and shift settings
// Run with: bun run scripts/seed.ts
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { DEFAULT_SHIFT } from '../src/lib/salary'

async function main() {
  // 1. Default admin
  const existing = await db.admin.findFirst()
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    await db.admin.create({
      data: {
        username: 'admin',
        passwordHash,
        name: 'System Administrator',
      },
    })
    console.log('Created default admin: admin / admin123')
  } else {
    console.log('Admin already exists, skipping.')
  }

  // 2. Default shift settings
  const settingsDefaults: Record<string, string> = {
    shiftStart: DEFAULT_SHIFT.shiftStart,
    shiftEnd: DEFAULT_SHIFT.shiftEnd,
    halfDayAfterMinutes: String(DEFAULT_SHIFT.halfDayAfterMinutes),
    absentAfterMinutes: String(DEFAULT_SHIFT.absentAfterMinutes),
    standardWorkingHours: String(DEFAULT_SHIFT.standardWorkingHours),
    companyName: 'Acme Workshop',
    lateThresholdMinutes: '15',
  }
  for (const [k, v] of Object.entries(settingsDefaults)) {
    const existing = await db.setting.findUnique({ where: { key: k } })
    if (!existing) {
      await db.setting.create({ data: { key: k, value: v } })
    }
  }
  console.log('Settings ensured.')

  // 3. Default attendance rules (late tiers + absent)
  const rulesExist = await db.attendanceRule.count()
  if (rulesExist === 0) {
    await db.attendanceRule.createMany({
      data: [
        { name: 'On Time (no deduction)', kind: 'LATE_TIER', minutesAfter: 0, deduction: 0, active: true },
        { name: 'Late after 15 min', kind: 'LATE_TIER', minutesAfter: 15, deduction: 100, active: true },
        { name: 'Late after 30 min', kind: 'LATE_TIER', minutesAfter: 30, deduction: 200, active: true },
        { name: 'Late after 60 min', kind: 'LATE_TIER', minutesAfter: 60, deduction: 500, active: true },
        { name: 'Full day absence', kind: 'ABSENT', minutesAfter: null, deduction: 0, active: true },
      ],
    })
    console.log('Default attendance rules created.')
  } else {
    console.log(`Rules already exist (${rulesExist}), skipping.`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
