import { NextRequest, NextResponse } from 'next/server'
import { requireEmployee } from '@/lib/employee-auth'
import { db } from '@/lib/db'
import {
  getMonthRange,
  getPreviousMonthRange,
  parseMonthParam,
  getEligibleWorkingDays,
  classifyZone,
  computeEmployeeStats,
  isRecordInValidEmploymentPeriod,
  EmployeeAttendanceStats,
  ZoneClassification,
} from '@/lib/attendance-statistics'
import { getLocalDateString } from '@/lib/salary'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployee()
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')

    if (monthParam) {
      const parsed = parseMonthParam(monthParam)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM.' }, { status: 400 })
      }
    }

    const shiftSettings = await db.setting.findMany({
      where: { key: { in: ['shiftStart', 'shiftEnd', 'halfDayAfterMinutes', 'absentAfterMinutes', 'standardWorkingHours', 'minCheckoutGapMinutes'] } },
      select: { key: true, value: true },
    })

    const shiftEndMinutes = shiftSettings.find(s => s.key === 'shiftEnd')?.value
      ? Number(shiftSettings.find(s => s.key === 'shiftEnd')!.value.split(':')[0]) * 60 +
        Number(shiftSettings.find(s => s.key === 'shiftEnd')!.value.split(':')[1])
      : 1080 // 18:00 default

    const monthRange = getMonthRange(monthParam ?? undefined, shiftEndMinutes)
    const prevRange = getPreviousMonthRange(monthRange.year, monthRange.month, shiftEndMinutes)

    const employee = await db.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        department: true,
        joinDate: true,
        employmentEndDate: true,
        createdAt: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const [selectedAttendances, previousAttendances, holidays] = await Promise.all([
      db.attendance.findMany({
        where: { employeeId: employee.id, date: { gte: monthRange.from, lte: monthRange.to } },
        select: {
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
          lateMinutes: true,
        },
      }),
      db.attendance.findMany({
        where: { employeeId: employee.id, date: { gte: prevRange.from, lte: prevRange.to } },
        select: {
          date: true,
          status: true,
          checkIn: true,
          checkOut: true,
          lateMinutes: true,
        },
      }),
      db.holiday.findMany({
        where: { active: true },
        select: { date: true },
      }),
    ])

    const holidaySet = new Set(holidays.map((h) => getLocalDateString(h.date)))
    const joinDate = employee.joinDate ? new Date(employee.joinDate) : new Date(employee.createdAt)
    const employmentEndDate = employee.employmentEndDate ? new Date(employee.employmentEndDate) : null

    const currentStats = computeEmployeeStats(
      employee.id,
      employee.employeeId,
      employee.name,
      employee.department,
      selectedAttendances,
      monthRange,
      holidaySet,
      joinDate,
      employmentEndDate,
    )

    const prevStats = computeEmployeeStats(
      employee.id,
      employee.employeeId,
      employee.name,
      employee.department,
      previousAttendances,
      prevRange,
      holidaySet,
      joinDate,
      employmentEndDate,
    )

    currentStats.previousMonthPercentage = prevStats.attendancePercentage
    currentStats.previousMonthZone = prevStats.currentZone
    if (currentStats.attendancePercentage !== null && prevStats.attendancePercentage !== null) {
      currentStats.trendDifference = currentStats.attendancePercentage - prevStats.attendancePercentage
    }

    // Generate automatic messages
    const messages = generateMessages(currentStats)

    // Build attendance history for the month (for calendar view)
    const attendanceHistory = buildAttendanceHistory(
      selectedAttendances,
      monthRange,
      holidaySet,
      joinDate,
      employee.employmentEndDate,
    )

    return NextResponse.json({
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
      },
      month: {
        year: monthRange.year,
        month: monthRange.month,
        isProvisional: monthRange.isCurrentMonth,
        cutoffDate: getLocalDateString(monthRange.cutoffDate),
      },
      stats: currentStats,
      messages,
      attendanceHistory,
      zoneConfig: {
        GREEN: { zone: 'GREEN', label: 'Excellent', color: 'emerald' },
        BLUE: { zone: 'BLUE', label: 'Acceptable', color: 'blue' },
        RED: { zone: 'RED', label: 'Poor', color: 'red' },
        NOT_RATED: { zone: 'NOT_RATED', label: 'Not Rated', color: 'slate' },
      },
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized' || e?.message === 'Session expired') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Employee portal stats error:', e)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}

function generateMessages(stats: EmployeeAttendanceStats): string[] {
  const messages: string[] = []

  // Zone message
  switch (stats.currentZone) {
    case 'GREEN':
      messages.push('Excellent attendance! Keep up the consistency.')
      break
    case 'BLUE':
      messages.push('Your attendance is good, but there is room for improvement.')
      break
    case 'RED':
      messages.push('Your attendance is low this month. Please improve regular attendance.')
      break
    case 'NOT_RATED':
      messages.push('Not enough eligible attendance data is available for this month.')
      break
  }

  // Missing checkout warning
  if (stats.missingCheckoutCount > 0) {
    messages.push(
      stats.missingCheckoutCount === 1
        ? 'You have a missing checkout record. Please contact the admin.'
        : `You have ${stats.missingCheckoutCount} missing checkout records. Please contact the admin.`
    )
  }

  // Declining trend warning
  if (stats.trendDifference !== null && stats.trendDifference < -2) {
    messages.push('Your attendance has decreased compared with last month.')
  }

  return messages
}

function buildAttendanceHistory(
  attendances: Array<{
    date: string
    status: string
    checkIn: Date | null
    checkOut: Date | null
    lateMinutes: number
  }>,
  monthRange: { year: number; month: number; daysInMonth: number; cutoffDate: Date; from: string; to: string },
  holidays: Set<string>,
  joinDate: Date,
  employmentEndDate: Date | null,
): Array<{
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  workingHours: number
  lateMinutes: number
  hasMissingCheckout: boolean
  source: string
  isHoliday: boolean
  isSunday: boolean
  isBeforeJoin: boolean
  isAfterEnd: boolean
  isFuture: boolean
}> {
  const { year, month, daysInMonth, cutoffDate } = monthRange
  const cutoffStr = getLocalDateString(cutoffDate)
  const joinDateStr = getLocalDateString(joinDate)
  const endDateStr = employmentEndDate ? getLocalDateString(employmentEndDate) : null

  const attendanceMap = new Map(attendances.map(a => [a.date, a]))

  const history: Array<{
    date: string
    status: string
    checkIn: string | null
    checkOut: string | null
    workingHours: number
    lateMinutes: number
    hasMissingCheckout: boolean
    source: string
    isHoliday: boolean
    isSunday: boolean
    isBeforeJoin: boolean
    isAfterEnd: boolean
    isFuture: boolean
  }> = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month - 1, d).getDay()
    const isSunday = dayOfWeek === 0
    const isHoliday = holidays.has(dateStr)
    const isBeforeJoin = dateStr < joinDateStr
    const isAfterEnd = endDateStr ? dateStr > endDateStr : false
    const isFuture = dateStr > cutoffStr

    let status: string
    let checkIn: string | null = null
    let checkOut: string | null = null
    let workingHours = 0
    let lateMinutes = 0
    let hasMissingCheckout = false
    let source = ''

    if (isFuture) {
      status = 'FUTURE'
    } else if (isSunday) {
      status = 'SUNDAY'
    } else if (isHoliday) {
      status = 'HOLIDAY'
    } else if (isBeforeJoin) {
      status = 'BEFORE_JOIN'
    } else if (isAfterEnd) {
      status = 'AFTER_END'
    } else {
      const att = attendanceMap.get(dateStr)
      if (att) {
        status = att.status
        checkIn = att.checkIn ? att.checkIn.toISOString() : null
        checkOut = att.checkOut ? att.checkOut.toISOString() : null
        lateMinutes = att.lateMinutes
        if (att.checkIn && att.checkOut) {
          workingHours = (att.checkOut.getTime() - att.checkIn.getTime()) / (1000 * 60 * 60)
        }
        if (att.checkIn && !att.checkOut) {
          hasMissingCheckout = true
        }
      } else {
        status = 'ABSENT'
      }
    }

    history.push({
      date: dateStr,
      status,
      checkIn,
      checkOut,
      workingHours: Math.round(workingHours * 100) / 100,
      lateMinutes,
      hasMissingCheckout,
      source,
      isHoliday,
      isSunday,
      isBeforeJoin,
      isAfterEnd,
      isFuture,
    })
  }

  return history
}