import { db } from '@/lib/db'
import { getLocalDateString, getISTParts, IST_TIME_ZONE, DEFAULT_SHIFT, timeStringToMinutes } from '@/lib/salary'

export interface ShiftSettingsInput {
  shiftStart: string
  shiftEnd: string
  halfDayAfterMinutes: number
  absentAfterMinutes: number
  standardWorkingHours: number
  minCheckoutGapMinutes: number
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

export interface ZoneClassification {
  zone: 'GREEN' | 'BLUE' | 'RED' | 'NOT_RATED'
  label: string
  color: string
}

export const ZONE_THRESHOLDS = {
  GREEN_MIN: 90,
  BLUE_MIN: 66,
} as const

export const MIN_ELIGIBLE_DAYS_FOR_RANKING = 5

export const ZONE_CONFIG: Record<ZoneClassification['zone'], ZoneClassification> = {
  GREEN: { zone: 'GREEN', label: 'Excellent', color: 'emerald' },
  BLUE: { zone: 'BLUE', label: 'Acceptable', color: 'blue' },
  RED: { zone: 'RED', label: 'Poor', color: 'red' },
  NOT_RATED: { zone: 'NOT_RATED', label: 'Not Rated', color: 'slate' },
}

export interface EmployeeAttendanceStats {
  employeeId: string
  employeeCode: string
  name: string
  department: string | null
  eligibleWorkingDays: number
  presentDays: number
  lateDays: number
  halfDays: number
  absentDays: number
  leaveDays: number
  earnedAttendanceDays: number
  attendancePercentage: number | null
  currentZone: ZoneClassification['zone']
  missingCheckoutCount: number
  previousMonthPercentage: number | null
  previousMonthZone: ZoneClassification['zone']
  trendDifference: number | null
  isProvisional: boolean
}

export interface WorkEfficiencySummary {
  totalEmployees: number
  ratedEmployees: number
  notRatedEmployees: number
  greenZoneCount: number
  blueZoneCount: number
  redZoneCount: number
  greenZonePercent: number
  blueZonePercent: number
  redZonePercent: number
  weightedCompanyAttendancePercent: number
  bestPerformingEmployees: EmployeeAttendanceStats[]
  lowestAttendanceEmployees: EmployeeAttendanceStats[]
  departmentAverages: Array<{ department: string; averagePercentage: number; employeeCount: number }>
  declinedEmployees: EmployeeAttendanceStats[]
  totalMissingCheckouts: number
  isProvisional: boolean
  cutoffDate: string
}

export interface MonthRange {
  year: number
  month: number
  from: string
  to: string
  daysInMonth: number
  isCurrentMonth: boolean
  cutoffDate: Date
  shiftEndMinutes: number
}

export function parseMonthParam(monthParam?: string): { year: number; month: number } | null {
  if (!monthParam) return null
  const match = monthParam.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12 || year < 1900 || year > 2100) return null
  return { year, month }
}

export function getMonthRange(monthParam?: string, shiftEndMinutes?: number): MonthRange {
  const parsed = parseMonthParam(monthParam)
  const istNow = getISTParts()
  const year = parsed ? parsed.year : istNow.year
  const month = parsed ? parsed.month : istNow.month
  const daysInMonth = new Date(year, month, 0).getDate()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  const isCurrentMonth = year === istNow.year && month === istNow.month

  const resolvedShiftEndMinutes = shiftEndMinutes ?? timeStringToMinutes(DEFAULT_SHIFT.shiftEnd)

  let cutoffDate: Date
  if (isCurrentMonth) {
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: IST_TIME_ZONE }))
    const currentISTMinutes = nowIST.getHours() * 60 + nowIST.getMinutes()
    if (currentISTMinutes >= resolvedShiftEndMinutes) {
      cutoffDate = new Date()
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      cutoffDate = yesterday
    }
  } else {
    cutoffDate = new Date(year, month - 1, daysInMonth, 23, 59, 59)
  }

  return { year, month, from, to, daysInMonth, isCurrentMonth, cutoffDate, shiftEndMinutes: resolvedShiftEndMinutes }
}

export function getPreviousMonthRange(year: number, month: number, shiftEndMinutes?: number): MonthRange {
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }
  return getMonthRange(`${prevYear}-${String(prevMonth).padStart(2, '0')}`, shiftEndMinutes)
}

export function getEligibleWorkingDays(
  year: number,
  month: number,
  joinDate: Date | null,
  employmentEndDate: Date | null,
  holidays: Set<string>,
  cutoffDate: Date,
  employeeLeaves: Set<string>,
): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  const joinDateStr = joinDate ? getLocalDateString(joinDate) : null
  const endDateStr = employmentEndDate ? getLocalDateString(employmentEndDate) : null
  const cutoffStr = getLocalDateString(cutoffDate)

  let workingDays = 0

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    if (dateStr > cutoffStr) continue
    if (new Date(year, month - 1, d).getDay() === 0) continue
    if (holidays.has(dateStr)) continue
    if (joinDateStr && dateStr < joinDateStr) continue
    if (endDateStr && dateStr > endDateStr) continue
    if (employeeLeaves.has(dateStr)) continue

    workingDays++
  }

  return workingDays
}

export function classifyZone(percentage: number | null): ZoneClassification['zone'] {
  if (percentage === null) return 'NOT_RATED'
  if (percentage >= ZONE_THRESHOLDS.GREEN_MIN) return 'GREEN'
  if (percentage >= ZONE_THRESHOLDS.BLUE_MIN) return 'BLUE'
  return 'RED'
}

export function isRecordInValidEmploymentPeriod(
  recordDateStr: string,
  joinDate: Date | null,
  employmentEndDate: Date | null,
): boolean {
  const joinDateStr = joinDate ? getLocalDateString(joinDate) : null
  const endDateStr = employmentEndDate ? getLocalDateString(employmentEndDate) : null
  if (joinDateStr && recordDateStr < joinDateStr) return false
  if (endDateStr && recordDateStr > endDateStr) return false
  return true
}

export function computeEmployeeStats(
  employeeId: string,
  employeeCode: string,
  name: string,
  department: string | null,
  attendances: Array<{
    date: string
    status: string
    checkIn: Date | null
    checkOut: Date | null
    lateMinutes: number
  }>,
  monthRange: MonthRange,
  holidays: Set<string>,
  joinDate: Date | null,
  employmentEndDate: Date | null,
): EmployeeAttendanceStats {
  const { year, month, cutoffDate, isCurrentMonth } = monthRange
  const cutoffStr = getLocalDateString(cutoffDate)

  const attendancesInMonth = attendances.filter((a) => {
    const parts = a.date.split('-')
    return Number(parts[0]) === year && Number(parts[1]) === month
  })

  const employeeLeaves = new Set<string>()
  for (const a of attendancesInMonth) {
    if (a.status === 'LEAVE') employeeLeaves.add(a.date)
  }

  const eligibleWorkingDays = getEligibleWorkingDays(
    year, month, joinDate, employmentEndDate, holidays, cutoffDate, employeeLeaves,
  )

  const joinDateStr = joinDate ? getLocalDateString(joinDate) : null
  const endDateStr = employmentEndDate ? getLocalDateString(employmentEndDate) : null

  let presentDays = 0
  let lateDays = 0
  let halfDays = 0
  let explicitAbsentDays = 0
  let leaveDays = 0
  let missingCheckoutCount = 0

  for (const a of attendancesInMonth) {
    if (!isRecordInValidEmploymentPeriod(a.date, joinDate, employmentEndDate)) continue
    if (a.date > cutoffStr) continue
    if (new Date(a.date).getDay() === 0) continue
    if (holidays.has(a.date)) continue

    let hasMissingCheckout = false
    switch (a.status) {
      case 'PRESENT':
        presentDays++
        if (a.checkIn && !a.checkOut) hasMissingCheckout = true
        break
      case 'LATE':
        lateDays++
        if (a.checkIn && !a.checkOut) hasMissingCheckout = true
        break
      case 'HALF_DAY':
        halfDays++
        if (a.checkIn && !a.checkOut) hasMissingCheckout = true
        break
      case 'ABSENT': explicitAbsentDays++; break
      case 'LEAVE': leaveDays++; break
    }

    if (hasMissingCheckout) missingCheckoutCount++
  }

  const recordedDates = new Set(
    attendancesInMonth
      .filter(a => a.date <= cutoffStr)
      .map(a => a.date),
  )

  let implicitAbsentDays = 0
  for (let d = 1; d <= monthRange.daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (dateStr > cutoffStr) continue
    if (new Date(year, month - 1, d).getDay() === 0) continue
    if (holidays.has(dateStr)) continue
    if (joinDateStr && dateStr < joinDateStr) continue
    if (endDateStr && dateStr > endDateStr) continue
    if (recordedDates.has(dateStr)) continue
    if (employeeLeaves.has(dateStr)) continue
    implicitAbsentDays++
  }

  const absentDays = explicitAbsentDays + implicitAbsentDays
  const earnedAttendanceDays = presentDays + lateDays + halfDays * 0.5

  let attendancePercentage: number | null = null
  if (eligibleWorkingDays > 0) {
    const raw = (earnedAttendanceDays / eligibleWorkingDays) * 100
    attendancePercentage = Math.min(raw, 100)
  }

  const currentZone = classifyZone(attendancePercentage)

  return {
    employeeId,
    employeeCode,
    name,
    department,
    eligibleWorkingDays,
    presentDays,
    lateDays,
    halfDays,
    absentDays,
    leaveDays,
    earnedAttendanceDays,
    attendancePercentage,
    currentZone,
    missingCheckoutCount,
    previousMonthPercentage: null,
    previousMonthZone: 'NOT_RATED',
    trendDifference: null,
    isProvisional: isCurrentMonth,
  }
}

export async function getWorkEfficiencyData(
  monthParam?: string,
  departmentFilter?: string,
  shiftSettings?: ShiftSettingsInput,
): Promise<{ summary: WorkEfficiencySummary; employees: EmployeeAttendanceStats[] }> {
  const parsed = parseMonthParam(monthParam)
  if (monthParam && !parsed) {
    throw new Error('Invalid month parameter. Use YYYY-MM format with valid values.')
  }

  const shiftEndMinutes = shiftSettings ? timeStringToMinutes(shiftSettings.shiftEnd) : undefined
  const monthRange = getMonthRange(monthParam, shiftEndMinutes)
  const { year, month, from, to, isCurrentMonth, cutoffDate } = monthRange
  const prevRange = getPreviousMonthRange(year, month, shiftEndMinutes)
  const prevFrom = prevRange.from
  const prevTo = prevRange.to

  const employees = await db.employee.findMany({
    where: departmentFilter ? { department: departmentFilter } : {},
    orderBy: { employeeId: 'asc' },
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

  const [selectedAttendances, previousAttendances, holidays] = await Promise.all([
    db.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      select: {
        employeeId: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        lateMinutes: true,
        deduction: true,
      },
    }),
    db.attendance.findMany({
      where: { date: { gte: prevFrom, lte: prevTo } },
      select: {
        employeeId: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        lateMinutes: true,
        deduction: true,
      },
    }),
    db.holiday.findMany({
      where: { active: true },
      select: { date: true },
    }),
  ])

  const holidaySet = new Set(holidays.map((h) => getLocalDateString(h.date)))
  const selectedByEmployee = new Map<string, typeof selectedAttendances>()
  for (const a of selectedAttendances) {
    const list = selectedByEmployee.get(a.employeeId) || []
    list.push(a)
    selectedByEmployee.set(a.employeeId, list)
  }
  const previousByEmployee = new Map<string, typeof previousAttendances>()
  for (const a of previousAttendances) {
    const list = previousByEmployee.get(a.employeeId) || []
    list.push(a)
    previousByEmployee.set(a.employeeId, list)
  }

  const employeeStats: EmployeeAttendanceStats[] = []

  for (const emp of employees) {
    const empSelectedAtt = selectedByEmployee.get(emp.id) || []
    const joinDate = emp.joinDate ?? emp.createdAt

    const stats = computeEmployeeStats(
      emp.id,
      emp.employeeId,
      emp.name,
      emp.department,
      empSelectedAtt,
      monthRange,
      holidaySet,
      joinDate,
      emp.employmentEndDate,
    )

    const prevEmpAtt = previousByEmployee.get(emp.id) || []
    const prevStats = computeEmployeeStats(
      emp.id,
      emp.employeeId,
      emp.name,
      emp.department,
      prevEmpAtt,
      prevRange,
      holidaySet,
      joinDate,
      emp.employmentEndDate,
    )

    stats.previousMonthPercentage = prevStats.attendancePercentage
    stats.previousMonthZone = prevStats.currentZone
    if (stats.attendancePercentage !== null && prevStats.attendancePercentage !== null) {
      stats.trendDifference = stats.attendancePercentage - prevStats.attendancePercentage
    }

    employeeStats.push(stats)
  }

  const ratedEmployees = employeeStats.filter((s) => s.attendancePercentage !== null)
  const notRatedEmployees = employeeStats.filter((s) => s.attendancePercentage === null)

  const greenZone = ratedEmployees.filter((s) => s.currentZone === 'GREEN')
  const blueZone = ratedEmployees.filter((s) => s.currentZone === 'BLUE')
  const redZone = ratedEmployees.filter((s) => s.currentZone === 'RED')

  const totalEarned = employeeStats.reduce((sum, s) => sum + s.earnedAttendanceDays, 0)
  const totalEligible = employeeStats.reduce((sum, s) => sum + s.eligibleWorkingDays, 0)
  const weightedCompanyAttendancePercent = totalEligible > 0 ? (totalEarned / totalEligible) * 100 : 0

  const rankableEmployees = ratedEmployees.filter(
    (s) => s.eligibleWorkingDays >= MIN_ELIGIBLE_DAYS_FOR_RANKING,
  )

  const bestPerforming = [...rankableEmployees]
    .sort((a, b) => (b.attendancePercentage ?? 0) - (a.attendancePercentage ?? 0))
    .slice(0, 5)

  const lowestAttendance = [...rankableEmployees]
    .sort((a, b) => (a.attendancePercentage ?? 100) - (b.attendancePercentage ?? 100))
    .slice(0, 5)

  const deptMap = new Map<string, { earned: number; eligible: number }>()
  for (const emp of employees) {
    const empStats = employeeStats.find(s => s.employeeId === emp.id)
    if (!empStats || empStats.eligibleWorkingDays === 0) continue
    const dept = empStats.department || 'Unassigned'
    const entry = deptMap.get(dept) || { earned: 0, eligible: 0 }
    entry.earned += empStats.earnedAttendanceDays
    entry.eligible += empStats.eligibleWorkingDays
    deptMap.set(dept, entry)
  }
  const departmentAverages = Array.from(deptMap.entries()).map(([department, { earned, eligible }]) => ({
    department,
    averagePercentage: eligible > 0 ? (earned / eligible) * 100 : 0,
    employeeCount: employeeStats.filter(s => (s.department || 'Unassigned') === department && s.eligibleWorkingDays > 0).length,
  }))

  const declinedEmployees = employeeStats.filter(
    (s) => s.trendDifference !== null && s.trendDifference < -5,
  )

  const totalMissingCheckouts = employeeStats.reduce((sum, s) => sum + s.missingCheckoutCount, 0)

  const summary: WorkEfficiencySummary = {
    totalEmployees: employees.length,
    ratedEmployees: ratedEmployees.length,
    notRatedEmployees: notRatedEmployees.length,
    greenZoneCount: greenZone.length,
    blueZoneCount: blueZone.length,
    redZoneCount: redZone.length,
    greenZonePercent: employees.length > 0 ? (greenZone.length / employees.length) * 100 : 0,
    blueZonePercent: employees.length > 0 ? (blueZone.length / employees.length) * 100 : 0,
    redZonePercent: employees.length > 0 ? (redZone.length / employees.length) * 100 : 0,
    weightedCompanyAttendancePercent,
    bestPerformingEmployees: bestPerforming,
    lowestAttendanceEmployees: lowestAttendance,
    departmentAverages,
    declinedEmployees,
    totalMissingCheckouts,
    isProvisional: isCurrentMonth,
    cutoffDate: getLocalDateString(cutoffDate),
  }

  return { summary, employees: employeeStats }
}

export function formatPercentage(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}%`
}

export function getZoneBadgeClass(zone: ZoneClassification['zone']): string {
  const map: Record<ZoneClassification['zone'], string> = {
    GREEN: 'bg-emerald-100 text-emerald-700',
    BLUE: 'bg-blue-100 text-blue-700',
    RED: 'bg-red-100 text-red-700',
    NOT_RATED: 'bg-slate-100 text-slate-700',
  }
  return map[zone]
}

export function getTrendIndicator(diff: number | null): { label: string; className: string; icon: 'up' | 'down' | 'flat' } {
  if (diff === null) return { label: '—', className: 'text-slate-500', icon: 'flat' }
  if (diff > 0.5) return { label: `+${diff.toFixed(1)}%`, className: 'text-emerald-600', icon: 'up' }
  if (diff < -0.5) return { label: `${diff.toFixed(1)}%`, className: 'text-red-600', icon: 'down' }
  return { label: `${diff.toFixed(1)}%`, className: 'text-slate-500', icon: 'flat' }
}