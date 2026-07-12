import { db } from '@/lib/db'
import { buildMonthlyReportRow } from '@/lib/salary'

export interface GeneratePayrollResult {
  run: Record<string, unknown> & { id: string; month: string; status: string; totalAmount: number; employeeCount: number; items: unknown[] }
  skipped: boolean
  reason?: string
}

/**
 * Calculates and upserts a DRAFT payroll run for one month (YYYY-MM), reusing
 * the exact same salary math as the Salary Reports view. Never approves,
 * pays, or moves money — a human still has to review and approve in the
 * Payroll tab before any payout file exists. Safe to call repeatedly while a
 * run is still DRAFT (it recalculates); once APPROVED/PAID it refuses to
 * touch the run and reports back as skipped instead of throwing, so the
 * monthly cron job never crashes on an already-handled month.
 */
export async function generatePayrollForMonth(month: string): Promise<GeneratePayrollResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('month must be in YYYY-MM format')
  }
  const [year, mo] = month.split('-').map(Number)
  if (mo < 1 || mo > 12) {
    throw new Error('Invalid month')
  }

  const existing = await db.payrollRun.findUnique({ where: { month } })
  if (existing && existing.status !== 'DRAFT') {
    const full = await db.payrollRun.findUniqueOrThrow({ where: { month }, include: { items: true } })
    return { run: full, skipped: true, reason: `Payroll for ${month} is already ${existing.status.toLowerCase()} and was not regenerated.` }
  }

  const from = `${year}-${String(mo).padStart(2, '0')}-01`
  const lastDay = new Date(year, mo, 0).getDate()
  const to = `${year}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const employees = await db.employee.findMany({
    where: { active: true },
    orderBy: { employeeId: 'asc' },
  })
  const attendances = await db.attendance.findMany({
    where: { date: { gte: from, lte: to } },
    select: { employeeId: true, date: true, status: true, deduction: true, overtimeHours: true, overtimePay: true },
  })

  const lineItems = employees.map((emp) => {
    const empAtt = attendances.filter((a) => a.employeeId === emp.id)
    const row = buildMonthlyReportRow(emp, empAtt, year, mo)
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeId,
      employeeName: emp.name,
      baseSalary: row.baseSalary,
      presentDays: row.presentDays,
      lateDays: row.lateDays,
      halfDays: row.halfDays,
      absentDays: row.absentDays,
      totalDeduction: row.totalDeduction,
      totalOvertimePay: row.totalOvertimePay,
      netPayable: row.payableSalary,
      bankAccountNumber: emp.bankAccountNumber,
      bankIFSC: emp.bankIFSC,
      bankAccountHolder: emp.bankAccountHolder,
    }
  })

  const totalAmount = lineItems.reduce((s, r) => s + r.netPayable, 0)

  const run = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.payrollLineItem.deleteMany({ where: { payrollRunId: existing.id } })
      return tx.payrollRun.update({
        where: { id: existing.id },
        data: {
          totalAmount,
          employeeCount: lineItems.length,
          generatedAt: new Date(),
          items: { create: lineItems },
        },
        include: { items: true },
      })
    }
    return tx.payrollRun.create({
      data: {
        month,
        totalAmount,
        employeeCount: lineItems.length,
        items: { create: lineItems },
      },
      include: { items: true },
    })
  })

  return { run, skipped: false }
}
