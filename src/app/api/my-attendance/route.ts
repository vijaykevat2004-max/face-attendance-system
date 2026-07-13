import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildMonthCalendar, getISTParts, getLocalDateString } from '@/lib/salary'

export const runtime = 'nodejs'

// Thresholds for the self-service attendance warning shown to the employee.
// Kept here (not per-employee) so the rule is uniform. Counts are per month.
const LATE_WARN = 3 // late/half-day days that trigger an amber warning
const ABSENT_WARN = 2 // absent days that trigger an amber warning
const LATE_CRITICAL = 6 // late/half-day days that escalate to a red warning
const ABSENT_CRITICAL = 4 // absent days that escalate to a red warning

interface AttendanceWarning {
  level: 'warning' | 'critical'
  reasons: string[]
}

/**
 * Decide whether the employee should see an attendance warning this month, and
 * how serious it is. Returns null when nothing is wrong. Uses only late / half-
 * day / absent counts — never salary data — so it stays safe on the public view.
 */
function buildAttendanceWarning(summary: {
  late: number
  halfDay: number
  absent: number
}): AttendanceWarning | null {
  const lateCount = summary.late + summary.halfDay
  const reasons: string[] = []

  if (lateCount >= LATE_WARN) {
    reasons.push(`${lateCount} late / half-day ${lateCount === 1 ? 'day' : 'days'} this month`)
  }
  if (summary.absent >= ABSENT_WARN) {
    reasons.push(`${summary.absent} ${summary.absent === 1 ? 'absence' : 'absences'} this month`)
  }

  if (reasons.length === 0) return null

  const critical = lateCount >= LATE_CRITICAL || summary.absent >= ABSENT_CRITICAL
  return { level: critical ? 'critical' : 'warning', reasons }
}

/**
 * GET /api/my-attendance?code=EMP-001&month=YYYY-MM
 * Public endpoint so an employee can check their own attendance calendar by
 * entering just their employee code — no admin login needed. Deliberately
 * returns ONLY attendance status (present/late/absent/leave) for that one
 * employee, never salary/deduction/bank figures, so this stays safe to leave
 * open without extra authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')?.trim()
    const monthParam = searchParams.get('month')

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const emp = await db.employee.findUnique({ where: { employeeId: code } })
    if (!emp || !emp.active) {
      return NextResponse.json({ error: 'Employee code not found' }, { status: 404 })
    }

    const istNow = getISTParts()
    const year = monthParam ? Number(monthParam.split('-')[0]) : istNow.year
    const month = monthParam ? Number(monthParam.split('-')[1]) : istNow.month
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
    }

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const attendances = await db.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: from, lte: to } },
      select: { date: true, status: true, checkIn: true, checkOut: true, overtimeHours: true },
    })

    const recorded = new Map(attendances.map((a) => [a.date, a.status]))
    const joinDateStr = getLocalDateString(emp.createdAt)
    const days = buildMonthCalendar(joinDateStr, year, month, recorded)

    const detailByDate = new Map(attendances.map((a) => [a.date, a]))
    const daysWithDetail = days.map((d) => ({
      ...d,
      checkIn: detailByDate.get(d.date)?.checkIn ?? null,
      checkOut: detailByDate.get(d.date)?.checkOut ?? null,
      overtimeHours: detailByDate.get(d.date)?.overtimeHours ?? 0,
    }))

    const summary = {
      present: days.filter((d) => d.status === 'PRESENT').length,
      late: days.filter((d) => d.status === 'LATE').length,
      halfDay: days.filter((d) => d.status === 'HALF_DAY').length,
      absent: days.filter((d) => d.status === 'ABSENT').length,
      leave: days.filter((d) => d.status === 'LEAVE').length,
      overtimeHours: attendances.reduce((s, a) => s + (a.overtimeHours || 0), 0),
    }

    const warning = buildAttendanceWarning(summary)

    return NextResponse.json({
      employee: { id: emp.id, employeeId: emp.employeeId, name: emp.name, department: emp.department },
      year,
      month,
      days: daysWithDetail,
      summary,
      warning,
    })
  } catch (e) {
    console.error('my-attendance error', e)
    return NextResponse.json({ error: 'Failed to load attendance' }, { status: 500 })
  }
}
