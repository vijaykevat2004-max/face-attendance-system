import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import {
  evaluateDay,
  effectiveDeduction,
  getLocalDateString,
  formatTime,
  getISTParts,
  type ShiftSettings,
  type LateTier,
  DEFAULT_SHIFT,
} from '@/lib/salary'

export const runtime = 'nodejs'

async function loadShiftAndTiers(): Promise<{ shift: ShiftSettings; tiers: LateTier[]; dailyWageFn: (base: number) => number; salaryDeductionEnabled: boolean }> {
  const settings = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  const shift: ShiftSettings = {
    shiftStart: map.shiftStart || DEFAULT_SHIFT.shiftStart,
    shiftEnd: map.shiftEnd || DEFAULT_SHIFT.shiftEnd,
    halfDayAfterMinutes: Number(map.halfDayAfterMinutes || DEFAULT_SHIFT.halfDayAfterMinutes),
    absentAfterMinutes: Number(map.absentAfterMinutes || DEFAULT_SHIFT.absentAfterMinutes),
    standardWorkingHours: Number(map.standardWorkingHours || DEFAULT_SHIFT.standardWorkingHours),
    minCheckoutGapMinutes: Number(map.minCheckoutGapMinutes || DEFAULT_SHIFT.minCheckoutGapMinutes),
  }

  const rules = await db.attendanceRule.findMany({
    where: { kind: 'LATE_TIER', active: true },
    orderBy: { minutesAfter: 'asc' },
  })
  const tiers: LateTier[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    minutesAfter: r.minutesAfter,
    deduction: r.deduction,
  }))

  const salaryDeductionEnabled = map.salaryDeductionEnabled === 'true'

  // Daily wage = base salary / working days in current month (excluding Sundays)
  const { year, month } = getISTParts()
  const daysInMonth = new Date(year, month, 0).getDate()
  let workingDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) workingDays++
  }
  const wd = workingDays || 1
  const dailyWageFn = (base: number) => base / wd

  return { shift, tiers, dailyWageFn, salaryDeductionEnabled }
}

/**
 * GET /api/attendance?date=YYYY-MM-DD      -> all attendance for that date (admin)
 * GET /api/attendance?from=...&to=...      -> range query (admin)
 * GET /api/attendance?employeeId=...       -> all attendance for one employee (admin)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const employeeId = searchParams.get('employeeId')

    const where: Record<string, unknown> = {}
    if (date) where.date = date
    else if (from && to) where.date = { gte: from, lte: to }
    if (employeeId) where.employeeId = employeeId

    const records = await db.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        employee: {
          select: { id: true, employeeId: true, name: true, department: true, baseSalary: true },
        },
      },
      take: 500,
    })

    return NextResponse.json({ records })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

/**
 * POST /api/attendance
 * Body: { employeeId, type: 'CHECK_IN' | 'CHECK_OUT' | 'AUTO' }
 * 'AUTO' (used by the single smart-scanner kiosk) picks CHECK_IN or CHECK_OUT
 * automatically based on the employee's attendance record for today.
 * Public endpoint — used from the live attendance kiosk. Does NOT require admin login,
 * but employee must exist & be active & have a matching face (the face match itself
 * happens client-side; here we just record by employeeId).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId } = body as { employeeId: string; type: 'CHECK_IN' | 'CHECK_OUT' | 'AUTO' }
    let { type } = body as { type: 'CHECK_IN' | 'CHECK_OUT' | 'AUTO' }

    if (!employeeId || !type) {
      return NextResponse.json({ error: 'employeeId and type required' }, { status: 400 })
    }

    const emp = await db.employee.findUnique({ where: { id: employeeId } })
    if (!emp || !emp.active) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 })
    }

    const { shift, tiers, dailyWageFn, salaryDeductionEnabled } = await loadShiftAndTiers()
    const now = new Date()
    const dateStr = getLocalDateString(now)

    if (type === 'AUTO') {
      const todayRecord = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
      })
      if (todayRecord?.checkIn && todayRecord?.checkOut) {
        return NextResponse.json({
          ok: false,
          alreadyCompleted: true,
          message: `${emp.name} has already completed today's attendance (in at ${formatTime(todayRecord.checkIn)}, out at ${formatTime(todayRecord.checkOut)}).`,
          attendance: todayRecord,
        })
      }
      if (todayRecord?.checkIn) {
        const gapMinutes = (now.getTime() - todayRecord.checkIn.getTime()) / 60000
        if (gapMinutes < shift.minCheckoutGapMinutes) {
          const allowedAt = new Date(todayRecord.checkIn.getTime() + shift.minCheckoutGapMinutes * 60000)
          return NextResponse.json({
            ok: false,
            tooSoonForCheckout: true,
            message: `${emp.name} already checked in at ${formatTime(todayRecord.checkIn)}. Check-out allowed after ${formatTime(allowedAt)}.`,
            attendance: todayRecord,
          })
        }
      }
      type = todayRecord?.checkIn ? 'CHECK_OUT' : 'CHECK_IN'
    }

    if (type === 'CHECK_IN') {
      // Duplicate prevention: if already checked in today and not checked out, block
      const existing = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
      })
      if (existing && existing.checkIn && !existing.checkOut) {
        return NextResponse.json({
          ok: false,
          alreadyCheckedIn: true,
          message: `${emp.name} already checked in today at ${formatTime(existing.checkIn)}`,
          attendance: existing,
        })
      }

      const dailyWage = dailyWageFn(emp.baseSalary)
      const result = evaluateDay(now, null, shift, tiers, dailyWage, emp.absentDeduction)
      result.deduction = effectiveDeduction(result.deduction, salaryDeductionEnabled)

      const record = await db.attendance.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
        update: {
          checkIn: now,
          status: result.status,
          lateMinutes: result.lateMinutes,
          deduction: result.deduction,
          note: result.note,
        },
        create: {
          employeeId: emp.id,
          date: dateStr,
          checkIn: now,
          status: result.status,
          lateMinutes: result.lateMinutes,
          deduction: result.deduction,
          note: result.note,
        },
      })

      return NextResponse.json({
        ok: true,
        action: 'CHECK_IN',
        employee: { id: emp.id, name: emp.name, employeeId: emp.employeeId },
        attendance: record,
        message: `Welcome ${emp.name}! Checked in at ${formatTime(now)}`,
      })
    } else {
      // CHECK_OUT
      const existing = await db.attendance.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
      })
      if (!existing || !existing.checkIn) {
        return NextResponse.json({
          ok: false,
          noCheckIn: true,
          message: `${emp.name} has not checked in today.`,
        })
      }
      if (existing.checkOut) {
        return NextResponse.json({
          ok: false,
          alreadyCheckedOut: true,
          message: `${emp.name} already checked out today at ${formatTime(existing.checkOut)}`,
          attendance: existing,
        })
      }

      const dailyWage = dailyWageFn(emp.baseSalary)
      const result = evaluateDay(existing.checkIn, now, shift, tiers, dailyWage, emp.absentDeduction)
      result.deduction = effectiveDeduction(result.deduction, salaryDeductionEnabled)

      const record = await db.attendance.update({
        where: { id: existing.id },
        data: {
          checkOut: now,
          workingHours: result.workingHours,
          status: result.status,
          lateMinutes: result.lateMinutes,
          deduction: result.deduction,
          note: result.note,
        },
      })

      return NextResponse.json({
        ok: true,
        action: 'CHECK_OUT',
        employee: { id: emp.id, name: emp.name, employeeId: emp.employeeId },
        attendance: record,
        message: `Goodbye ${emp.name}! Checked out at ${formatTime(now)} (${result.workingHours.toFixed(2)}h)`,
      })
    }
  } catch (e: any) {
    console.error('attendance POST error', e)
    return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 })
  }
}