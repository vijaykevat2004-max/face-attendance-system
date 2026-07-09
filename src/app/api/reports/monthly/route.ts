import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { buildMonthlyReportRow, getWorkingDaysInMonth, getISTParts } from '@/lib/salary'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month') // YYYY-MM

    const istNow = getISTParts()
    const year = monthParam ? Number(monthParam.split('-')[0]) : istNow.year
    const month = monthParam ? Number(monthParam.split('-')[1]) : istNow.month

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month. Use YYYY-MM.' }, { status: 400 })
    }

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const employees = await db.employee.findMany({
      where: { active: true },
      orderBy: { employeeId: 'asc' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        department: true,
        baseSalary: true,
        absentDeduction: true,
        createdAt: true,
      },
    })

    const attendances = await db.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        employeeId: true,
        status: true,
        deduction: true,
        checkIn: true,
        checkOut: true,
        lateMinutes: true,
        workingHours: true,
        date: true,
      },
    })

    const workingDays = getWorkingDaysInMonth(year, month)

    const rows = employees.map((emp) => {
      const empAtt = attendances.filter((a) => a.employeeId === emp.id)
      const row = buildMonthlyReportRow(emp, empAtt, year, month)
      return {
        ...row,
        // Per-day breakdown for detailed view
        days: empAtt.map((a) => ({
          date: a.date,
          status: a.status,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          lateMinutes: a.lateMinutes,
          workingHours: a.workingHours,
          deduction: a.deduction,
        })),
      }
    })

    const totals = {
      payrollBase: rows.reduce((s, r) => s + r.baseSalary, 0),
      totalDeduction: rows.reduce((s, r) => s + r.totalDeduction, 0),
      payable: rows.reduce((s, r) => s + r.payableSalary, 0),
      presentDays: rows.reduce((s, r) => s + r.presentDays, 0),
      lateDays: rows.reduce((s, r) => s + r.lateDays, 0),
      halfDays: rows.reduce((s, r) => s + r.halfDays, 0),
      absentDays: rows.reduce((s, r) => s + r.absentDays, 0),
    }

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      year,
      monthNumber: month,
      workingDays,
      employeeCount: employees.length,
      rows,
      totals,
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
