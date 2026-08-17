import { PrismaClient } from '@prisma/client'
import { getISTParts, getLocalDateString } from '../src/lib/salary'

const db = new PrismaClient()

async function main() {
  // Get all employees
  const employees = await db.employee.findMany({ 
    select: { id: true, employeeId: true, name: true, baseSalary: true, department: true, joinDate: true, createdAt: true } 
  })
  console.log('=== EMPLOYEES ===')
  console.log(JSON.stringify(employees, null, 2))

  // Current IST date
  const ist = getISTParts()
  const year = ist.year
  const month = ist.month
  const daysInMonth = new Date(year, month, 0).getDate()

  console.log(`\n=== TESTING FOR ${year}-${String(month).padStart(2, '0')} (${daysInMonth} days) ===`)

  // Clear existing attendance for this month
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  
  await db.attendance.deleteMany({
    where: { date: { gte: from, lte: to } }
  })
  console.log('Cleared existing attendance for current month')

  // Add test data for each employee
  for (const emp of employees) {
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date(emp.createdAt)
    const joinDateStr = getLocalDateString(joinDate)
    
    console.log(`\n--- Adding attendance for ${emp.name} (${emp.employeeId}) ---`)
    console.log(`Base Salary: ${emp.baseSalary}, Dept: ${emp.department}, Join: ${joinDateStr}`)

    const attendances = []
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = new Date(year, month - 1, d).getDay()
      const isSunday = dayOfWeek === 0
      
      // Skip if before join date
      if (dateStr < joinDateStr) continue
      
      // Determine status based on employee type
      let status: 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'
      let checkIn: Date | null = null
      let checkOut: Date | null = null
      let lateMinutes = 0
      let workingHours = 0
      let overtimeHours = 0
      let overtimePay = 0

      if (isSunday) {
        status = 'ABSENT' // Will be excluded from eligible days
      } else if (emp.employeeId === 'EMP-010') {
        // mahendra - 100% present (GREEN zone)
        status = 'PRESENT'
        checkIn = new Date(`${dateStr}T09:00:00`)
        checkOut = new Date(`${dateStr}T18:00:00`)
        workingHours = 9
      } else if (emp.employeeId === 'EMP-001') {
        // First employee - mix of present/late/absent (BLUE zone ~75%)
        const rand = Math.random()
        if (rand < 0.7) {
          status = 'PRESENT'
          checkIn = new Date(`${dateStr}T09:00:00`)
          checkOut = new Date(`${dateStr}T18:00:00`)
          workingHours = 9
        } else if (rand < 0.85) {
          status = 'LATE'
          checkIn = new Date(`${dateStr}T09:30:00`)
          checkOut = new Date(`${dateStr}T18:00:00`)
          lateMinutes = 30
          workingHours = 8.5
        } else {
          status = 'ABSENT'
        }
      } else {
        // Others - mostly present with some late
        const rand = Math.random()
        if (rand < 0.8) {
          status = 'PRESENT'
          checkIn = new Date(`${dateStr}T09:00:00`)
          checkOut = new Date(`${dateStr}T18:00:00`)
          workingHours = 9
        } else if (rand < 0.95) {
          status = 'LATE'
          checkIn = new Date(`${dateStr}T09:45:00`)
          checkOut = new Date(`${dateStr}T18:00:00`)
          lateMinutes = 45
          workingHours = 8.25
        } else {
          status = 'ABSENT'
        }
      }

      // Add some overtime for GREEN zone employee
      if (emp.employeeId === 'EMP-010' && d % 5 === 0) {
        overtimeHours = 2
        overtimePay = 2 * (emp.baseSalary / 26 / 8) * 1.5 // 1.5x multiplier
      }

      attendances.push({
        employeeId: emp.id,
        date: dateStr,
        status,
        checkIn,
        checkOut,
        lateMinutes,
        workingHours,
        deduction: 0,
        source: 'WORKSHOP',
        overtimeHours,
        overtimePay,
      })
    }

    // Bulk create
    if (attendances.length > 0) {
      await db.attendance.createMany({ data: attendances })
      console.log(`Created ${attendances.length} attendance records`)
    }
  }

  // Verify work efficiency API
  console.log('\n=== WORK EFFICIENCY CHECK ===')
  
  // Test the stats API logic directly
  const { getMonthRange, getPreviousMonthRange, parseMonthParam, getEligibleWorkingDays, classifyZone, computeEmployeeStats, isRecordInValidEmploymentPeriod } = await import('../src/lib/attendance-statistics')
  
  const monthParam = `${year}-${String(month).padStart(2, '0')}`
  const monthRange = getMonthRange(monthParam)
  const prevRange = getPreviousMonthRange(monthRange.year, monthRange.month)
  
  console.log(`Month range: ${monthRange.from} to ${monthRange.to}`)
  console.log(`Cutoff: ${getLocalDateString(monthRange.cutoffDate)}`)
  console.log(`Is current month: ${monthRange.isCurrentMonth}`)

  // Get holidays
  const holidays = await db.holiday.findMany({ where: { active: true }, select: { date: true } })
  const holidaySet = new Set(holidays.map(h => getLocalDateString(h.date)))
  console.log(`Active holidays: ${holidaySet.size}`)

  // Test each employee
  for (const emp of employees) {
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date(emp.createdAt)
    
    const atts = await db.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: monthRange.from, lte: monthRange.to } },
      select: { date: true, status: true, checkIn: true, checkOut: true, lateMinutes: true }
    })

    const stats = computeEmployeeStats(
      emp.id,
      emp.employeeId,
      emp.name,
      emp.department,
      atts,
      monthRange,
      holidaySet,
      joinDate,
      null
    )

    console.log(`\n${emp.name} (${emp.employeeId}):`)
    console.log(`  Eligible: ${stats.eligibleWorkingDays}, Present: ${stats.presentDays}, Late: ${stats.lateDays}, Half: ${stats.halfDays}, Absent: ${stats.absentDays}, Leave: ${stats.leaveDays}`)
    console.log(`  Earned: ${stats.earnedAttendanceDays}, %: ${stats.attendancePercentage?.toFixed(1) || 'N/A'}, Zone: ${stats.currentZone}`)
    console.log(`  Missing checkout: ${stats.missingCheckoutCount}`)
  }

  // Test payroll generation
  console.log('\n=== PAYROLL GENERATION TEST ===')
  
  // Check existing payroll
  const existingPayroll = await db.payrollRun.findUnique({ where: { month: monthParam } })
  if (existingPayroll) {
    console.log(`Payroll already exists for ${monthParam}: ${existingPayroll.status}`)
  } else {
    console.log(`No payroll for ${monthParam} - will generate`)
  }

  // Test Excel export logic
  console.log('\n=== EXCEL EXPORT DATA CHECK ===')
  
  // Get all employees with attendance for payroll
  const payrollEmployees = await db.employee.findMany({
    where: { active: true },
    select: { id: true, employeeId: true, name: true, department: true, baseSalary: true, absentDeduction: true, joinDate: true, employmentEndDate: true, createdAt: true }
  })

  for (const emp of payrollEmployees) {
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date(emp.createdAt)
    const atts = await db.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: monthRange.from, lte: monthRange.to } },
      select: { date: true, status: true, checkIn: true, checkOut: true, lateMinutes: true, overtimeHours: true, overtimePay: true, deduction: true }
    })

    const joinDateStr = getLocalDateString(joinDate)
    const endDateStr = emp.employmentEndDate ? getLocalDateString(new Date(emp.employmentEndDate)) : null
    const cutoffStr = getLocalDateString(monthRange.cutoffDate)

    const employeeLeaves = new Set(atts.filter(a => a.status === 'LEAVE').map(a => a.date))
    
    const eligibleDays = getEligibleWorkingDays(
      monthRange.year, monthRange.month, joinDate, emp.employmentEndDate, holidaySet, monthRange.cutoffDate, employeeLeaves
    )

    let presentDays = 0, lateDays = 0, halfDays = 0, explicitAbsentDays = 0, leaveDays = 0, missingCheckoutCount = 0, totalOvertimePay = 0

    for (const a of atts) {
      if (!isRecordInValidEmploymentPeriod(a.date, joinDate, emp.employmentEndDate)) continue
      if (a.date > cutoffStr) continue
      if (new Date(a.date).getDay() === 0) continue
      if (holidaySet.has(a.date)) continue

      let hasMissingCheckout = false
      switch (a.status) {
        case 'PRESENT': presentDays++; if (a.checkIn && !a.checkOut) hasMissingCheckout = true; break
        case 'LATE': lateDays++; if (a.checkIn && !a.checkOut) hasMissingCheckout = true; break
        case 'HALF_DAY': halfDays++; if (a.checkIn && !a.checkOut) hasMissingCheckout = true; break
        case 'ABSENT': explicitAbsentDays++; break
        case 'LEAVE': leaveDays++; break
      }
      if (hasMissingCheckout) missingCheckoutCount++
      totalOvertimePay += a.overtimePay || 0
    }

    const recordedDates = new Set(atts.filter(a => a.date <= cutoffStr).map(a => a.date))
    let implicitAbsentDays = 0
    for (let d = 1; d <= monthRange.daysInMonth; d++) {
      const dateStr = `${monthRange.year}-${String(monthRange.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (dateStr > cutoffStr) continue
      if (new Date(monthRange.year, monthRange.month - 1, d).getDay() === 0) continue
      if (holidaySet.has(dateStr)) continue
      if (joinDateStr && dateStr < joinDateStr) continue
      if (endDateStr && dateStr > endDateStr) continue
      if (recordedDates.has(dateStr)) continue
      if (employeeLeaves.has(dateStr)) continue
      implicitAbsentDays++
    }

    const absentDays = explicitAbsentDays + implicitAbsentDays
    const earnedAttendanceDays = presentDays + lateDays + halfDays * 0.5
    const attendancePercentage = eligibleDays > 0 ? Math.min((earnedAttendanceDays / eligibleDays) * 100, 100) : null
    const zone = classifyZone(attendancePercentage)

    const dailyWage = emp.baseSalary / eligibleDays
    const absentDeduction = emp.absentDeduction ?? dailyWage
    const totalDeduction = absentDays * absentDeduction
    const netPayable = emp.baseSalary - totalDeduction + totalOvertimePay

    console.log(`\n${emp.name} (${emp.employeeId}):`)
    console.log(`  Base: ${emp.baseSalary}, Daily wage: ${dailyWage.toFixed(2)}`)
    console.log(`  Present: ${presentDays}, Late: ${lateDays}, Half: ${halfDays}, Absent: ${absentDays}, Leave: ${leaveDays}`)
    console.log(`  Eligible: ${eligibleDays}, Earned: ${earnedAttendanceDays}, %: ${attendancePercentage?.toFixed(1) || 'N/A'}, Zone: ${zone}`)
    console.log(`  Deduction: ${totalDeduction.toFixed(2)}, OT Pay: ${totalOvertimePay.toFixed(2)}, Net: ${netPayable.toFixed(2)}`)
  }

  await db.$disconnect()
  console.log('\n=== DEEP TEST COMPLETE ===')
}

main().catch(console.error)