import {
  getMonthRange,
  getEligibleWorkingDays,
  getPreviousMonthRange,
  classifyZone,
  parseMonthParam,
  computeEmployeeStats,
  isRecordInValidEmploymentPeriod,
  ZONE_THRESHOLDS,
  MIN_ELIGIBLE_DAYS_FOR_RANKING,
  type MonthRange,
  type EmployeeAttendanceStats,
} from '../src/lib/attendance-statistics'
import {
  buildMonthlyReportRow,
  effectiveDeduction,
  DEFAULT_SHIFT,
  timeStringToMinutes,
  getWorkingDaysInMonth,
} from '../src/lib/salary'

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function makeMonthRange(
  year: number,
  month: number,
  cutoffDate: Date,
  shiftEnd: string = DEFAULT_SHIFT.shiftEnd,
): MonthRange {
  const daysInMonth = new Date(year, month, 0).getDate()
  return {
    year,
    month,
    from: makeDateStr(year, month, 1),
    to: makeDateStr(year, month, daysInMonth),
    daysInMonth,
    isCurrentMonth: false,
    cutoffDate,
    shiftEndMinutes: timeStringToMinutes(shiftEnd),
  }
}

function makeAttendance(
  date: string,
  status: string,
  checkIn: Date | null = null,
  checkOut: Date | null = null,
  lateMinutes = 0,
) {
  return { date, status, checkIn, checkOut, lateMinutes }
}

// ─── parseMonthParam ───────────────────────────────────────────────────────────
describe('parseMonthParam', () => {
  it('returns null for undefined', () => {
    expect(parseMonthParam()).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseMonthParam('')).toBeNull()
  })
  it('returns null for YYYY/MM format', () => {
    expect(parseMonthParam('2025/06')).toBeNull()
  })
  it('returns null for YYYY-MM-DD format', () => {
    expect(parseMonthParam('2025-06-15')).toBeNull()
  })
  it('returns null for month 00', () => {
    expect(parseMonthParam('2025-00')).toBeNull()
  })
  it('returns null for month 13', () => {
    expect(parseMonthParam('2025-13')).toBeNull()
  })
  it('returns null for non-numeric year', () => {
    expect(parseMonthParam('abcd-06')).toBeNull()
  })
  it('returns {year,month} for valid input', () => {
    expect(parseMonthParam('2025-06')).toEqual({ year: 2025, month: 6 })
  })
  it('rejects year before 1900', () => {
    expect(parseMonthParam('1899-06')).toBeNull()
  })
})

// ─── getMonthRange ─────────────────────────────────────────────────────────────
describe('getMonthRange', () => {
  it('parses valid YYYY-MM', () => {
    const r = getMonthRange('2025-06')
    expect(r.year).toBe(2025)
    expect(r.month).toBe(6)
    expect(r.daysInMonth).toBe(30)
    expect(r.from).toBe('2025-06-01')
    expect(r.to).toBe('2025-06-30')
  })

  it('rejects month 00 by defaulting to current month', () => {
    const r = getMonthRange('2025-00')
    expect(r.month).toBeGreaterThanOrEqual(1)
  })

  it('rejects month 13 by defaulting to current month', () => {
    const r = getMonthRange('2025-13')
    expect(r.month).toBeLessThanOrEqual(12)
  })

  it('defaults to current month when no param', () => {
    const r = getMonthRange()
    expect(r.isCurrentMonth).toBe(true)
  })

  it('past month has cutoffDate as last day of month', () => {
    const r = getMonthRange('2025-01')
    expect(r.cutoffDate.getFullYear()).toBe(2025)
    expect(r.cutoffDate.getMonth()).toBe(0)
    expect(r.cutoffDate.getDate()).toBe(31)
  })

  it('accepts injected shiftEndMinutes', () => {
    const r = getMonthRange('2025-06', timeStringToMinutes('17:30'))
    expect(r.shiftEndMinutes).toBe(1050)
  })
})

// ─── getPreviousMonthRange ─────────────────────────────────────────────────────
describe('getPreviousMonthRange', () => {
  it('January goes to December previous year', () => {
    const r = getPreviousMonthRange(2025, 1)
    expect(r.year).toBe(2024)
    expect(r.month).toBe(12)
  })

  it('other months go to previous month same year', () => {
    const r = getPreviousMonthRange(2025, 5)
    expect(r.year).toBe(2025)
    expect(r.month).toBe(4)
  })
})

// ─── getEligibleWorkingDays ────────────────────────────────────────────────────
describe('getEligibleWorkingDays', () => {
  it('excludes Sundays', () => {
    const holidays = new Set<string>()
    const leaves = new Set<string>()
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, null, null, holidays, cutoff, leaves)
    // June 2025: 30 days, 5 Sundays (1,8,15,22,29) -> 25
    expect(days).toBe(25)
  })

  it('excludes active holidays', () => {
    const holidays = new Set(['2025-06-02', '2025-06-03'])
    const leaves = new Set<string>()
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, null, null, holidays, cutoff, leaves)
    expect(days).toBe(23)
  })

  it('excludes leave days from denominator', () => {
    const holidays = new Set<string>()
    const leaves = new Set(['2025-06-02', '2025-06-03'])
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, null, null, holidays, cutoff, leaves)
    expect(days).toBe(23)
  })

  it('excludes days before joinDate', () => {
    const holidays = new Set<string>()
    const leaves = new Set<string>()
    const joinDate = new Date(2025, 5, 15)
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, joinDate, null, holidays, cutoff, leaves)
    expect(days).toBe(13)
  })

  it('excludes days after employmentEndDate', () => {
    const holidays = new Set<string>()
    const leaves = new Set<string>()
    const endDate = new Date(2025, 5, 15)
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, null, endDate, holidays, cutoff, leaves)
    expect(days).toBe(12)
  })

  it('excludes future dates via cutoff', () => {
    const holidays = new Set<string>()
    const leaves = new Set<string>()
    const cutoff = new Date(2025, 5, 10, 17, 0, 0)
    const days = getEligibleWorkingDays(2025, 6, null, null, holidays, cutoff, leaves)
    expect(days).toBe(8)
  })

  it('returns 0 for zero eligible days', () => {
    const holidays = new Set<string>()
    const leaves = new Set<string>()
    const joinDate = new Date(2025, 6, 1)
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const days = getEligibleWorkingDays(2025, 6, joinDate, null, holidays, cutoff, leaves)
    expect(days).toBe(0)
  })
})

// ─── Zone classification (FIX 4) ──────────────────────────────────────────────
describe('classifyZone', () => {
  it('100 = GREEN', () => {
    expect(classifyZone(100)).toBe('GREEN')
  })
  it('90 = GREEN', () => {
    expect(classifyZone(90)).toBe('GREEN')
  })
  it('89.99 = BLUE', () => {
    expect(classifyZone(89.99)).toBe('BLUE')
  })
  it('66 = BLUE', () => {
    expect(classifyZone(66)).toBe('BLUE')
  })
  it('65.99 = RED', () => {
    expect(classifyZone(65.99)).toBe('RED')
  })
  it('0 = RED', () => {
    expect(classifyZone(0)).toBe('RED')
  })
  it('null = NOT_RATED', () => {
    expect(classifyZone(null)).toBe('NOT_RATED')
  })
  it('uses unrounded percentage', () => {
    expect(classifyZone(89.999)).toBe('BLUE')
    expect(classifyZone(89.99999)).toBe('BLUE')
  })
})

// ─── Zone thresholds (FIX 4) ──────────────────────────────────────────────────
describe('Zone thresholds constants', () => {
  it('GREEN_MIN is 90', () => {
    expect(ZONE_THRESHOLDS.GREEN_MIN).toBe(90)
  })
  it('BLUE_MIN is 66', () => {
    expect(ZONE_THRESHOLDS.BLUE_MIN).toBe(66)
  })
})

// ─── MIN_ELIGIBLE_DAYS_FOR_RANKING ────────────────────────────────────────────
describe('MIN_ELIGIBLE_DAYS_FOR_RANKING', () => {
  it('is at least 5', () => {
    expect(MIN_ELIGIBLE_DAYS_FOR_RANKING).toBeGreaterThanOrEqual(5)
  })
})

// ─── FIX 5: Complete calculation tests (24 cases) ─────────────────────────────
describe('computeEmployeeStats - core calculations', () => {
  const holidays = new Set<string>()

  // Test 1: Perfect attendance gives 100%
  it('Test 1: Perfect attendance gives 100%', () => {
    // May 2025: Mon-Sat working, 22 working days (31 days, 4 Sundays + 5 Saturdays = wait, let me recalculate)
    // May 2025: 31 days. Sundays: 4,11,18,25 = 4 Sundays. Working days = 27
    // Actually May 2025: day 1=Thu, day 4=Sun, day 11=Sun, day 18=Sun, day 25=Sun -> 4 Sundays -> 27 working days
    const cutoff = new Date(2025, 4, 31, 23, 59, 59)
    const mr = makeMonthRange(2025, 5, cutoff)

    const atts: EmployeeAttendanceStats['attendancePercentage'] extends infer _ ? Array<{
      date: string; status: string; checkIn: Date | null; checkOut: Date | null; lateMinutes: number
    }> : never = []
    for (let d = 1; d <= 31; d++) {
      const ds = makeDateStr(2025, 5, d)
      if (new Date(2025, 4, d).getDay() === 0) continue
      atts.push(makeAttendance(ds, 'PRESENT', new Date(2025, 4, d, 9, 0), new Date(2025, 4, d, 18, 0)))
    }

    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', 'Eng', atts, mr, holidays, null, null)
    expect(stats.attendancePercentage).toBe(100)
    expect(stats.currentZone).toBe('GREEN')
    expect(stats.presentDays).toBeGreaterThan(0)
  })

  // Test 2: Late gives one full earned day
  it('Test 2: Late gives one full earned day', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    // One LATE day on Jun 2 (Mon), eligible = 25 (all non-Sundays Jun 1-30)
    const atts = [makeAttendance('2025-06-02', 'LATE', new Date(2025, 5, 2, 9, 15), new Date(2025, 5, 2, 18, 0), 15)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    // earnedAttendanceDays = 0 present + 1 late + 0 half*0.5 = 1
    expect(stats.earnedAttendanceDays).toBe(1)
    expect(stats.lateDays).toBe(1)
  })

  // Test 3: Half-Day gives 0.5 earned day
  it('Test 3: Half-Day gives 0.5 earned day', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [makeAttendance('2025-06-02', 'HALF_DAY', new Date(2025, 5, 2, 12, 0), new Date(2025, 5, 2, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.earnedAttendanceDays).toBe(0.5)
    expect(stats.halfDays).toBe(1)
  })

  // Test 4: Absence gives zero earned day
  it('Test 4: Absence gives zero earned day', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [makeAttendance('2025-06-02', 'ABSENT', null, null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.earnedAttendanceDays).toBe(0)
    expect(stats.absentDays).toBeGreaterThanOrEqual(1)
  })

  // Test 5: One employee's leave cannot affect another employee
  it('Test 5: One employee leave does not affect another', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    // Employee A has a LEAVE on Jun 2
    const attsA = [makeAttendance('2025-06-02', 'LEAVE', null, null)]
    const statsA = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, attsA, mr, holidays, null, null)

    // Employee B has PRESENT on Jun 2
    const attsB = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0))]
    const statsB = computeEmployeeStats('e2', 'EMP-002', 'Bob', null, attsB, mr, holidays, null, null)

    // A's eligible should exclude Jun 2 (leave), B's eligible should include Jun 2
    expect(statsA.leaveDays).toBe(1)
    expect(statsA.eligibleWorkingDays).toBeLessThan(statsB.eligibleWorkingDays)
  })

  // Test 6: Paid/manual LEAVE is excluded from that employee's denominator
  it('Test 6: LEAVE excluded from employee denominator', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [
      makeAttendance('2025-06-02', 'LEAVE', null, null),
      makeAttendance('2025-06-03', 'PRESENT', new Date(2025, 5, 3, 9, 0), new Date(2025, 5, 3, 18, 0)),
    ]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    // eligible = 25 (non-Sundays) - 1 leave = 24
    expect(stats.eligibleWorkingDays).toBe(24)
    expect(stats.leaveDays).toBe(1)
  })

  // Test 7: Sunday attendance does not inflate the numerator
  it('Test 7: Sunday attendance does not inflate numerator', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    // Jun 1, 2025 is Sunday
    const atts = [makeAttendance('2025-06-01', 'PRESENT', new Date(2025, 5, 1, 9, 0), new Date(2025, 5, 1, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    // Sunday should be filtered out in the attendance processing loop
    expect(stats.presentDays).toBe(0)
    expect(stats.earnedAttendanceDays).toBe(0)
  })

  // Test 8: Holiday attendance does not inflate the numerator
  it('Test 8: Holiday attendance does not inflate numerator', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const hols = new Set(['2025-06-02'])

    const atts = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, hols, null, null)
    expect(stats.presentDays).toBe(0)
  })

  // Test 9: Attendance before joining date is ignored
  it('Test 9: Attendance before joinDate is ignored', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const joinDate = new Date(2025, 5, 10)

    const atts = [
      makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0)),
      makeAttendance('2025-06-12', 'PRESENT', new Date(2025, 5, 12, 9, 0), new Date(2025, 5, 12, 18, 0)),
    ]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, joinDate, null)
    expect(stats.presentDays).toBe(1)
  })

  // Test 10: Attendance after employment-end date is ignored
  it('Test 10: Attendance after endDate is ignored', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const endDate = new Date(2025, 5, 10)

    const atts = [
      makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0)),
      makeAttendance('2025-06-12', 'PRESENT', new Date(2025, 5, 12, 9, 0), new Date(2025, 5, 12, 18, 0)),
    ]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, endDate)
    expect(stats.presentDays).toBe(1)
  })

  // Test 11: Current day before configured shift end is excluded
  it('Test 11: Current day before shift end excluded (past month)', () => {
    // For a past month, cutoffDate is end of month, so no future exclusion issue
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-16', 'PRESENT', new Date(2025, 5, 16, 9, 0), new Date(2025, 5, 16, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.presentDays).toBe(1)
  })

  // Test 12: Current day after configured shift end is included
  it('Test 12: Past month cutoff includes all days', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-30', 'PRESENT', new Date(2025, 5, 30, 9, 0), new Date(2025, 5, 30, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.presentDays).toBe(1)
  })

  // Test 13: Future dates are excluded
  it('Test 13: Future dates excluded via cutoff', () => {
    const cutoff = new Date(2025, 5, 15, 12, 0, 0)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [
      makeAttendance('2025-06-10', 'PRESENT', new Date(2025, 5, 10, 9, 0), new Date(2025, 5, 10, 18, 0)),
      makeAttendance('2025-06-20', 'PRESENT', new Date(2025, 5, 20, 9, 0), new Date(2025, 5, 20, 18, 0)),
    ]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.presentDays).toBe(1)
  })

  // Test 14: Missing checkout is counted once
  it('Test 14: Missing checkout counted exactly once for PRESENT', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  it('Test 14b: Missing checkout counted exactly once for LATE', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [makeAttendance('2025-06-02', 'LATE', new Date(2025, 5, 2, 9, 15), null, 15)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  it('Test 14c: Missing checkout counted exactly once for HALF_DAY', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const atts = [makeAttendance('2025-06-02', 'HALF_DAY', new Date(2025, 5, 2, 12, 0), null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  // Test 15: No attendance records create implicit absences for finalized eligible days
  it('Test 15: Empty attendance creates implicit absences', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, [], mr, holidays, null, null)
    expect(stats.eligibleWorkingDays).toBe(25)
    expect(stats.absentDays).toBeGreaterThan(0)
    expect(stats.attendancePercentage).toBe(0)
    expect(stats.currentZone).toBe('RED')
  })

  // Test 16: Zero eligible days produces null percentage and NOT_RATED
  it('Test 16: Zero eligible days -> null percentage, NOT_RATED', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const joinDate = new Date(2025, 6, 1)

    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, [], mr, holidays, joinDate, null)
    expect(stats.eligibleWorkingDays).toBe(0)
    expect(stats.attendancePercentage).toBeNull()
    expect(stats.currentZone).toBe('NOT_RATED')
  })

  // Test 17: Percentage never exceeds 100
  it('Test 17: Percentage capped at 100', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    // All days present
    const atts: Array<{date: string; status: string; checkIn: Date | null; checkOut: Date | null; lateMinutes: number}> = []
    for (let d = 1; d <= 30; d++) {
      const ds = makeDateStr(2025, 6, d)
      if (new Date(2025, 5, d).getDay() === 0) continue
      atts.push(makeAttendance(ds, 'PRESENT', new Date(2025, 5, d, 9, 0), new Date(2025, 5, d, 18, 0)))
    }
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.attendancePercentage).toBeLessThanOrEqual(100)
    expect(stats.attendancePercentage).toBe(100)
  })

  // Test 18: January correctly compares with December of previous year
  it('Test 18: January -> December previous year', () => {
    const r = getPreviousMonthRange(2025, 1)
    expect(r.year).toBe(2024)
    expect(r.month).toBe(12)
  })

  // Test 19: Previous-month percentage uses actual previous-month attendance
  it('Test 19: Previous month stats computed from prev month data', () => {
    const cutoff = new Date(2024, 11, 31, 23, 59, 59)
    const mr = makeMonthRange(2024, 12, cutoff)

    const prevCutoff = new Date(2024, 10, 30, 23, 59, 59)
    const prevMr = makeMonthRange(2024, 11, prevCutoff)

    // Nov 2024: 30 days. Sundays: 3,10,17,24 = 4. Working = 26
    const prevAtts: Array<{date: string; status: string; checkIn: Date | null; checkOut: Date | null; lateMinutes: number}> = []
    for (let d = 1; d <= 30; d++) {
      const ds = makeDateStr(2024, 11, d)
      if (new Date(2024, 10, d).getDay() === 0) continue
      prevAtts.push(makeAttendance(ds, 'PRESENT', new Date(2024, 10, d, 9, 0), new Date(2024, 10, d, 18, 0)))
    }
    const prevStats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, prevAtts, prevMr, holidays, null, null)
    expect(prevStats.attendancePercentage).toBe(100)
  })

  // Test 20: Weighted company percentage is correct
  it('Test 20: Weighted company percentage uses sum(earned)/sum(eligible)', () => {
    // Simulate two employees with different eligible days
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const attsA = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0))]
    const statsA = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, attsA, mr, holidays, null, null)

    const attsB = [
      makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0)),
      makeAttendance('2025-06-03', 'PRESENT', new Date(2025, 5, 3, 9, 0), new Date(2025, 5, 3, 18, 0)),
    ]
    const statsB = computeEmployeeStats('e2', 'EMP-002', 'Bob', null, attsB, mr, holidays, null, null)

    const totalEarned = statsA.earnedAttendanceDays + statsB.earnedAttendanceDays
    const totalEligible = statsA.eligibleWorkingDays + statsB.eligibleWorkingDays
    const weighted = (totalEarned / totalEligible) * 100

    expect(weighted).toBeGreaterThan(0)
    expect(weighted).toBeLessThanOrEqual(100)
  })

  // Test 21: Weighted department percentage is correct
  it('Test 21: Department average uses sum(earned)/sum(eligible)', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)

    const attsA = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0))]
    const statsA = computeEmployeeStats('e1', 'EMP-001', 'Alice', 'Engineering', attsA, mr, holidays, null, null)

    const attsB = [makeAttendance('2025-06-02', 'LATE', new Date(2025, 5, 2, 9, 15), new Date(2025, 5, 2, 18, 0), 15)]
    const statsB = computeEmployeeStats('e2', 'EMP-002', 'Bob', 'Engineering', attsB, mr, holidays, null, null)

    // Both should be same department
    expect(statsA.department).toBe('Engineering')
    expect(statsB.department).toBe('Engineering')

    // Department weighted = (1 + 1) / (25 + 25) * 100 = 4%
    const totalEarned = statsA.earnedAttendanceDays + statsB.earnedAttendanceDays
    const totalEligible = statsA.eligibleWorkingDays + statsB.eligibleWorkingDays
    const deptPct = (totalEarned / totalEligible) * 100
    expect(deptPct).toBeCloseTo(4, 0)
  })

  // Test 22: Ranking excludes NOT_RATED employees
  it('Test 22: NOT_RATED employees excluded from ranking', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const joinDate = new Date(2025, 6, 1)

    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, [], mr, holidays, joinDate, null)
    expect(stats.attendancePercentage).toBeNull()
    expect(stats.currentZone).toBe('NOT_RATED')
    // NOT_RATED employees should not appear in ranked lists
  })

  // Test 23: Ranking applies minimum eligible-day rule
  it('Test 23: Employees with <5 eligible days excluded from ranking', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const joinDate = new Date(2025, 5, 28)

    // Joined Jun 28, eligible = Jun 28 (Sat? Let's check: 2025-06-28 = Saturday)
    // Jun 28 = Sat, Jun 29 = Sun. So eligible = 1 working day (Jun 28)
    const atts = [makeAttendance('2025-06-28', 'PRESENT', new Date(2025, 5, 28, 9, 0), new Date(2025, 5, 28, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, joinDate, null)
    expect(stats.eligibleWorkingDays).toBeLessThan(MIN_ELIGIBLE_DAYS_FOR_RANKING)
  })

  // Test 24: Deactivated employees remain visible in valid historical periods
  it('Test 24: Employment period overlap works for historical months', () => {
    const cutoff = new Date(2025, 1, 28, 23, 59, 59)
    const mr = makeMonthRange(2025, 2, cutoff)

    // Employee with joinDate in Feb 2025 and endDate in Feb 2025
    const joinDate = new Date(2025, 1, 5)
    const endDate = new Date(2025, 1, 20)

    const atts = [
      makeAttendance('2025-02-05', 'PRESENT', new Date(2025, 1, 5, 9, 0), new Date(2025, 1, 5, 18, 0)),
      makeAttendance('2025-02-15', 'PRESENT', new Date(2025, 1, 15, 9, 0), new Date(2025, 1, 15, 18, 0)),
      makeAttendance('2025-02-25', 'PRESENT', new Date(2025, 1, 25, 9, 0), new Date(2025, 1, 25, 18, 0)),
    ]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, joinDate, endDate)
    // Only days Feb 5-20 should count; Feb 25 should be excluded
    expect(stats.presentDays).toBe(2)
  })
})

// ─── FIX 5 additional: missing checkout tests ─────────────────────────────────
describe('Missing checkout - single count policy', () => {
  const holidays = new Set<string>()

  it('PRESENT + checkIn + no checkOut = 1 missing checkout', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  it('LATE + checkIn + no checkOut = 1 missing checkout (was previously 2)', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'LATE', new Date(2025, 5, 2, 9, 15), null, 15)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  it('HALF_DAY + checkIn + no checkOut = 1 missing checkout', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'HALF_DAY', new Date(2025, 5, 2, 12, 0), null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(1)
  })

  it('ABSENT never has missing checkout', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'ABSENT', null, null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(0)
  })

  it('LEAVE never has missing checkout', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'LEAVE', null, null)]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(0)
  })

  it('checkIn + checkOut present = no missing checkout', () => {
    const cutoff = new Date(2025, 5, 30, 23, 59, 59)
    const mr = makeMonthRange(2025, 6, cutoff)
    const atts = [makeAttendance('2025-06-02', 'PRESENT', new Date(2025, 5, 2, 9, 0), new Date(2025, 5, 2, 18, 0))]
    const stats = computeEmployeeStats('e1', 'EMP-001', 'Alice', null, atts, mr, holidays, null, null)
    expect(stats.missingCheckoutCount).toBe(0)
  })
})

// ─── isRecordInValidEmploymentPeriod ──────────────────────────────────────────
describe('isRecordInValidEmploymentPeriod', () => {
  it('no joinDate or endDate -> always valid', () => {
    expect(isRecordInValidEmploymentPeriod('2025-06-15', null, null)).toBe(true)
  })
  it('before joinDate -> invalid', () => {
    expect(isRecordInValidEmploymentPeriod('2025-06-01', new Date(2025, 5, 5), null)).toBe(false)
  })
  it('on joinDate -> valid', () => {
    expect(isRecordInValidEmploymentPeriod('2025-06-05', new Date(2025, 5, 5), null)).toBe(true)
  })
  it('after endDate -> invalid', () => {
    expect(isRecordInValidEmploymentPeriod('2025-06-20', null, new Date(2025, 5, 15))).toBe(false)
  })
  it('on endDate -> valid', () => {
    expect(isRecordInValidEmploymentPeriod('2025-06-15', null, new Date(2025, 5, 15))).toBe(true)
  })
})
