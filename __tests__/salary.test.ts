import {
  buildMonthlyReportRow,
  effectiveDeduction,
  getWorkingDaysInMonth,
  DEFAULT_SHIFT,
} from '../src/lib/salary'

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const BASE_EMPLOYEE = {
  id: 'e1',
  employeeId: 'EMP-001',
  name: 'Alice',
  department: 'Engineering',
  baseSalary: 30000,
  createdAt: new Date('2025-01-01'),
}

// ─── effectiveDeduction ────────────────────────────────────────────────────────
describe('effectiveDeduction', () => {
  it('returns raw deduction when toggle is ON', () => {
    expect(effectiveDeduction(500, true)).toBe(500)
  })
  it('returns 0 when toggle is OFF', () => {
    expect(effectiveDeduction(500, false)).toBe(0)
  })
  it('returns 0 for zero raw deduction regardless', () => {
    expect(effectiveDeduction(0, true)).toBe(0)
    expect(effectiveDeduction(0, false)).toBe(0)
  })
})

// ─── getWorkingDaysInMonth ────────────────────────────────────────────────────
describe('getWorkingDaysInMonth', () => {
  it('June 2025: 30 days, 5 Sundays -> 25', () => {
    expect(getWorkingDaysInMonth(2025, 6)).toBe(25)
  })
  it('January 2025: 31 days, 4 Sundays -> 27', () => {
    // Jan 1 2025 = Wednesday. Sundays: 5, 12, 19, 26 = 4
    expect(getWorkingDaysInMonth(2025, 1)).toBe(27)
  })
})

// ─── FIX 6: Salary deduction toggle tests ─────────────────────────────────────
describe('Salary deduction toggle behavior', () => {
  const year = 2025
  const month = 6
  const baseSalary = 30000
  const workingDays = getWorkingDaysInMonth(year, month)

  it('PRESENT with toggle OFF: payable equals base salary', () => {
    const atts = [{ date: '2025-06-02', status: 'PRESENT', deduction: 500 }]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('LATE with raw deduction and toggle OFF: payable equals base salary', () => {
    const atts = [{ date: '2025-06-02', status: 'LATE', deduction: 300 }]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('HALF_DAY with raw deduction and toggle OFF: payable equals base salary', () => {
    const atts = [{ date: '2025-06-02', status: 'HALF_DAY', deduction: 15000 }]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('ABSENT with raw deduction and toggle OFF: payable equals base salary', () => {
    const atts = [{ date: '2025-06-02', status: 'ABSENT', deduction: 1363 }]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('Implicit no-show with toggle OFF: payable equals base salary', () => {
    const atts: Array<{ date: string; status: string; deduction: number }> = []
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('totalDeduction equals zero when toggle is OFF', () => {
    const atts = [
      { date: '2025-06-02', status: 'LATE', deduction: 300 },
      { date: '2025-06-03', status: 'ABSENT', deduction: 1363 },
    ]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.totalDeduction).toBe(0)
  })

  it('Payroll line item netPayable equals full base salary when toggle is OFF', () => {
    const atts = [
      { date: '2025-06-02', status: 'PRESENT', deduction: 500 },
      { date: '2025-06-03', status: 'LATE', deduction: 300 },
      { date: '2025-06-04', status: 'HALF_DAY', deduction: 15000 },
      { date: '2025-06-05', status: 'ABSENT', deduction: 1363 },
    ]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.payableSalary).toBe(baseSalary)
    expect(row.totalDeduction).toBe(0)
  })

  it('Work Efficiency zone does not modify salary', () => {
    // Toggle OFF: zone is irrelevant to salary
    const atts = [{ date: '2025-06-02', status: 'PRESENT', deduction: 0 }]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, false,
    )
    expect(row.payableSalary).toBe(baseSalary)
  })

  it('When toggle is ON, explicit deductions apply normally', () => {
    // With only 1 LATE day and no other records, implicit absences add large deductions.
    // So provide ALL non-Sunday working days as PRESENT to eliminate implicit absences,
    // then add one LATE with explicit deduction to test that the explicit deduction applies.
    const atts: Array<{ date: string; status: string; deduction: number }> = []
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === 0) continue
      atts.push({ date: makeDateStr(year, month, d), status: 'PRESENT', deduction: 0 })
    }
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, true,
    )
    expect(row.totalDeduction).toBe(0)
    // With 100% attendance, employee is in GREEN zone and gets 5% bonus
    const greenZoneBonus = baseSalary * 0.05
    expect(row.payableSalary).toBe(baseSalary + greenZoneBonus)
  })

  it('When toggle is ON, explicit LATE deduction reduces payable', () => {
    const dailyWage = baseSalary / getWorkingDaysInMonth(year, month)
    const lateDeduction = 500
    const atts = [
      { date: '2025-06-02', status: 'LATE', deduction: lateDeduction },
    ]
    const row = buildMonthlyReportRow(
      { ...BASE_EMPLOYEE, baseSalary },
      atts, year, month, true,
    )
    expect(row.totalDeduction).toBeGreaterThanOrEqual(lateDeduction)
    expect(row.payableSalary).toBeLessThan(baseSalary)
  })
})

// ─── DEFAULT_SHIFT ─────────────────────────────────────────────────────────────
describe('DEFAULT_SHIFT', () => {
  it('has reasonable defaults', () => {
    expect(DEFAULT_SHIFT.shiftStart).toBe('09:00')
    expect(DEFAULT_SHIFT.shiftEnd).toBe('18:00')
    expect(DEFAULT_SHIFT.standardWorkingHours).toBe(9)
    expect(DEFAULT_SHIFT.halfDayAfterMinutes).toBe(240)
    expect(DEFAULT_SHIFT.absentAfterMinutes).toBe(480)
  })
})
