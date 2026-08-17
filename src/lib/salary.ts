// Salary calculation and attendance rule helpers

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'

export interface LateTier {
  id: string
  name: string
  minutesAfter: number | null // null = absent tier
  deduction: number
}

export interface ShiftSettings {
  shiftStart: string // HH:MM (24h)
  shiftEnd: string   // HH:MM (24h)
  halfDayAfterMinutes: number // minutes late after which counts as half day
  absentAfterMinutes: number  // minutes late after which counts as absent
  standardWorkingHours: number // expected hours per day
  minCheckoutGapMinutes: number // min minutes after check-in before a check-out scan is accepted
  overtimeMultiplier: number // pay multiplier applied to the hourly rate for hours beyond standardWorkingHours (e.g. 1.5 = "time and a half"); 0 disables overtime pay
}

export const DEFAULT_SHIFT: ShiftSettings = {
  shiftStart: '09:00',
  shiftEnd: '18:00',
  halfDayAfterMinutes: 240,   // 4 hours late = half day
  absentAfterMinutes: 480,    // 8 hours late / no show = absent
  standardWorkingHours: 9,
  minCheckoutGapMinutes: 60,  // block accidental checkout within 1 hour of check-in
  overtimeMultiplier: 1.5,
}

export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getMinutesLate(checkIn: Date, shift: ShiftSettings): number {
  const checkInMins = checkIn.getHours() * 60 + checkIn.getMinutes()
  const shiftStartMins = timeStringToMinutes(shift.shiftStart)
  return Math.max(0, checkInMins - shiftStartMins)
}

export function calcWorkingHours(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60))
}

export interface DayResult {
  status: AttendanceStatus
  lateMinutes: number
  workingHours: number
  overtimeHours: number
  overtimePay: number
  deduction: number
  note?: string
}

/**
 * Calculate attendance status & deduction for a single check-in/out.
 * - PRESENT: arrived on time or up to (halfDayAfterMinutes) late, no deduction unless a late tier matched
 * - LATE:    arrived after shift start but within half-day window; tiered deduction may apply
 * - HALF_DAY: arrived very late (past halfDayAfterMinutes); half-day salary deducted
 * - ABSENT:  no check-in at all OR arrived past absentAfterMinutes
 */
export function evaluateDay(
  checkIn: Date | null,
  checkOut: Date | null,
  shift: ShiftSettings,
  tiers: LateTier[],
  dailyWage: number,
  absentDeductionOverride?: number | null,
): DayResult {
  // Per-employee custom absence rate, if the admin set one; otherwise the full daily wage.
  const absentDeduction = absentDeductionOverride ?? dailyWage

  // No check-in at all → absent
  if (!checkIn) {
    return {
      status: 'ABSENT',
      lateMinutes: 0,
      workingHours: 0,
      overtimeHours: 0,
      overtimePay: 0,
      deduction: absentDeduction,
      note: 'No check-in recorded',
    }
  }

  const lateMins = getMinutesLate(checkIn, shift)
  let status: AttendanceStatus = 'PRESENT'
  let note: string | undefined

  if (lateMins === 0) {
    status = 'PRESENT'
  } else if (lateMins < shift.halfDayAfterMinutes) {
    status = 'LATE'
    note = `Late by ${lateMins} min`
  } else if (lateMins < shift.absentAfterMinutes) {
    status = 'HALF_DAY'
    note = `Late by ${lateMins} min — half day`
  } else {
    status = 'ABSENT'
    note = `Late by ${lateMins} min — marked absent`
  }

  // Compute deduction
  let deduction = 0

  if (status === 'ABSENT') {
    deduction = absentDeduction
  } else if (status === 'HALF_DAY') {
    deduction = dailyWage / 2
  } else if (status === 'LATE') {
    // Find highest matching tier: tier.minutesAfter is "minutes after shift start"
    // Take the tier with the largest minutesAfter that is <= lateMins
    const matching = tiers
      .filter((t) => t.minutesAfter !== null && t.minutesAfter !== undefined && t.minutesAfter <= lateMins)
      .sort((a, b) => (b.minutesAfter ?? 0) - (a.minutesAfter ?? 0))
    if (matching.length > 0) {
      deduction = matching[0].deduction
    }
  }

  const workingHours = checkOut ? calcWorkingHours(checkIn, checkOut) : 0

  // Overtime only applies to a day the employee actually completed — extra
  // hours logged while LATE/HALF_DAY/ABSENT still count (they showed up and
  // put the time in), just not while there's no check-out yet.
  let overtimeHours = 0
  let overtimePay = 0
  if (checkOut && workingHours > shift.standardWorkingHours && shift.overtimeMultiplier > 0) {
    overtimeHours = workingHours - shift.standardWorkingHours
    const hourlyRate = shift.standardWorkingHours > 0 ? dailyWage / shift.standardWorkingHours : 0
    overtimePay = overtimeHours * hourlyRate * shift.overtimeMultiplier
  }

  return {
    status,
    lateMinutes: lateMins,
    workingHours,
    overtimeHours,
    overtimePay,
    deduction,
    note,
  }
}

/**
 * Return effective deduction: when salaryDeductionEnabled is false, always 0.
 */
export function effectiveDeduction(rawDeduction: number, salaryDeductionEnabled: boolean): number {
  return salaryDeductionEnabled ? rawDeduction : 0
}

export interface MonthlyReportRow {
  employeeId: string
  employeeCode: string
  name: string
  department: string | null
  baseSalary: number
  presentDays: number
  lateDays: number
  halfDays: number
  absentDays: number
  leaveDays: number
  totalDeduction: number
  totalOvertimeHours: number
  totalOvertimePay: number
  payableSalary: number
}

/**
 * Builds a monthly payroll/report row for one employee.
 *
 * When salaryDeductionEnabled is false, totalDeduction is always 0 and
 * payableSalary equals baseSalary (full salary).
 */
export function buildMonthlyReportRow(
  emp: {
    id: string
    employeeId: string
    name: string
    department: string | null
    baseSalary: number
    joinDate?: Date | string | null
    createdAt: Date | string
    absentDeduction?: number | null
  },
  attendances: Array<{
    date: string
    status: string
    deduction: number
    overtimeHours?: number
    overtimePay?: number
  }>,
  year: number,
  month: number, // 1-indexed
  salaryDeductionEnabled: boolean = false,
): MonthlyReportRow {
  const presentDays = attendances.filter((a) => a.status === 'PRESENT').length
  const lateDays = attendances.filter((a) => a.status === 'LATE').length
  const halfDays = attendances.filter((a) => a.status === 'HALF_DAY').length
  const explicitAbsentDays = attendances.filter((a) => a.status === 'ABSENT').length
  const leaveDays = attendances.filter((a) => a.status === 'LEAVE').length
  const explicitDeduction = attendances.reduce((s, a) => s + (a.deduction || 0), 0)
  const totalOvertimeHours = attendances.reduce((s, a) => s + (a.overtimeHours || 0), 0)
  const totalOvertimePay = attendances.reduce((s, a) => s + (a.overtimePay || 0), 0)

  const workingDaysInMonth = getWorkingDaysInMonth(year, month)
  const dailyWage = workingDaysInMonth > 0 ? emp.baseSalary / workingDaysInMonth : 0
  const perAbsentDayRate = emp.absentDeduction ?? dailyWage

  const recordedDates = new Set(attendances.map((a) => a.date))
  const joinDate = emp.joinDate ?? emp.createdAt
  const joinDateStr = getLocalDateString(typeof joinDate === 'string' ? new Date(joinDate) : joinDate)
  const todayDateStr = getLocalDateString()
  const daysInMonth = new Date(year, month, 0).getDate()

  let implicitAbsentDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 0) continue // Sunday
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (dateStr > todayDateStr || dateStr < joinDateStr) continue
    if (!recordedDates.has(dateStr)) implicitAbsentDays++
  }
  const implicitDeduction = implicitAbsentDays * perAbsentDayRate

  const absentDays = explicitAbsentDays + implicitAbsentDays
  const rawTotalDeduction = explicitDeduction + implicitDeduction
  const totalDeduction = salaryDeductionEnabled ? rawTotalDeduction : 0
  const payableSalary = Math.max(0, emp.baseSalary - totalDeduction + totalOvertimePay)

  return {
    employeeId: emp.id,
    employeeCode: emp.employeeId,
    name: emp.name,
    department: emp.department,
    baseSalary: emp.baseSalary,
    presentDays,
    lateDays,
    halfDays,
    absentDays,
    leaveDays,
    totalDeduction,
    totalOvertimeHours,
    totalOvertimePay,
    payableSalary,
  }
}

/**
 * Working days in a month excluding Sundays.
 * (Can be extended to honor a holidays table later.)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  // month is 1-indexed
  const daysInMonth = new Date(year, month, 0).getDate()
  let working = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0) working++ // skip Sundays
  }
  return working
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// This app runs on servers whose system timezone is UTC (e.g. Vercel), but the
// business is in India — every date/time shown to a user, or used to decide
// which calendar day an attendance record belongs to, must be pinned to IST
// regardless of where the code executes. Never use Date.getHours()/getDate()/
// toLocaleTimeString() without timeZone here.
export const IST_TIME_ZONE = 'Asia/Kolkata'

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: IST_TIME_ZONE,
  })
}

export function formatTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: IST_TIME_ZONE,
  })
}

export function getLocalDateString(d: Date = new Date()): string {
  // YYYY-MM-DD in IST, regardless of the server/browser's own timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function getISTParts(d: Date = new Date()): { year: number; month: number; day: number } {
  const [year, month, day] = getLocalDateString(d).split('-').map(Number)
  return { year, month, day }
}

export type CalendarDayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'SUNDAY' | 'FUTURE' | 'NO_DATA'

export interface CalendarDay {
  date: string
  status: CalendarDayStatus
}

/**
 * Builds a full-month, day-by-day attendance view for the calendar UI —
 * mirrors the exact day-classification rules used in buildMonthlyReportRow
 * (Sundays excluded, days before the employee joined excluded, days without
 * any record treated as an absence) so the calendar always agrees with the
 * payroll numbers for the same month.
 */
export function buildMonthCalendar(
  joinDateStr: string,
  year: number,
  month: number, // 1-indexed
  recorded: Map<string, string>, // date -> status
): CalendarDay[] {
  const todayDateStr = getLocalDateString()
  const daysInMonth = new Date(year, month, 0).getDate()
  const result: CalendarDay[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(year, month - 1, d).getDay()

    if (dateStr > todayDateStr) {
      result.push({ date: dateStr, status: 'FUTURE' })
    } else if (dateStr < joinDateStr) {
      result.push({ date: dateStr, status: 'NO_DATA' })
    } else if (dow === 0) {
      result.push({ date: dateStr, status: 'SUNDAY' })
    } else if (recorded.has(dateStr)) {
      result.push({ date: dateStr, status: recorded.get(dateStr) as CalendarDayStatus })
    } else {
      result.push({ date: dateStr, status: 'ABSENT' })
    }
  }

  return result
}
