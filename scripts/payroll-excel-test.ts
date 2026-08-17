import { PrismaClient } from '@prisma/client'
import { getISTParts, getLocalDateString } from '../src/lib/salary'
import { computeEmployeeStats, getMonthRange, getEligibleWorkingDays, classifyZone, isRecordInValidEmploymentPeriod } from '../src/lib/attendance-statistics'

const db = new PrismaClient()

async function testPayrollAndExcel() {
  const monthParam = '2026-08'
  const monthRange = getMonthRange(monthParam)
  const holidays = await db.holiday.findMany({ where: { active: true }, select: { date: true } })
  const holidaySet = new Set(holidays.map(h => getLocalDateString(h.date)))

  // Get all active employees
  const employees = await db.employee.findMany({
    where: { active: true },
    select: { id: true, employeeId: true, name: true, department: true, baseSalary: true, absentDeduction: true, joinDate: true, employmentEndDate: true, createdAt: true }
  })

  console.log('=== PAYROLL CALCULATION FOR EXCEL EXPORT ===\n')

  for (const emp of employees) {
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date(emp.createdAt)
    const endDate = emp.employmentEndDate ? new Date(emp.employmentEndDate) : null
    
    const atts = await db.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: monthRange.from, lte: monthRange.to } },
      select: { date: true, status: true, checkIn: true, checkOut: true, lateMinutes: true, overtimeHours: true, overtimePay: true }
    })

    const joinDateStr = getLocalDateString(joinDate)
    const endDateStr = endDate ? getLocalDateString(endDate) : null
    const cutoffStr = getLocalDateString(monthRange.cutoffDate)

    const employeeLeaves = new Set(atts.filter(a => a.status === 'LEAVE').map(a => a.date))
    
    const eligibleDays = getEligibleWorkingDays(
      monthRange.year, monthRange.month, joinDate, endDate, holidaySet, monthRange.cutoffDate, employeeLeaves
    )

    if (eligibleDays === 0) {
      console.log(`${emp.name} (${emp.employeeId}): SKIPPED - 0 eligible days`)
      continue
    }

    let presentDays = 0, lateDays = 0, halfDays = 0, explicitAbsentDays = 0, leaveDays = 0, missingCheckoutCount = 0, totalOvertimePay = 0, totalOvertimeHours = 0

    for (const a of atts) {
      if (!isRecordInValidEmploymentPeriod(a.date, joinDate, endDate)) continue
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
      totalOvertimeHours += a.overtimeHours || 0
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
    const attendancePercentage = (earnedAttendanceDays / eligibleDays) * 100
    const zone = classifyZone(Math.min(attendancePercentage, 100))

    const dailyWage = emp.baseSalary / eligibleDays
    const absentDeductionPerDay = emp.absentDeduction ?? dailyWage
    const totalDeduction = absentDays * absentDeductionPerDay
    const netPayable = emp.baseSalary - totalDeduction + totalOvertimePay

    // GREEN zone bonus (5% of base salary)
    const greenZoneBonus = zone === 'GREEN' ? emp.baseSalary * 0.05 : 0

    console.log(`${emp.name} (${emp.employeeId})`)
    console.log(`  Base: ₹${emp.baseSalary.toLocaleString()}, Daily: ₹${dailyWage.toFixed(2)}`)
    console.log(`  P:${presentDays} L:${lateDays} H:${halfDays} A:${absentDays} LV:${leaveDays} | Eligible:${eligibleDays} Earned:${earnedAttendanceDays.toFixed(1)} %:${attendancePercentage.toFixed(1)} Zone:${zone}`)
    console.log(`  Deduction: ₹${totalDeduction.toFixed(2)} (₹${absentDeductionPerDay.toFixed(2)}/day × ${absentDays} days)`)
    console.log(`  OT: ${totalOvertimeHours.toFixed(1)}h = ₹${totalOvertimePay.toFixed(2)}`)
    console.log(`  GREEN Bonus: ₹${greenZoneBonus.toFixed(2)}`)
    console.log(`  NET: ₹${(netPayable + greenZoneBonus).toFixed(2)}`)
    console.log('')
  }

  // Test Excel export format
  console.log('=== EXCEL EXPORT COLUMNS ===')
  console.log('Employee Code | Name | Department | Base Salary | Present | Late | Half Day | Absent | Leave | Eligible Days | Earned Days | Attendance % | Zone | Deduction | OT Hours | OT Pay | Green Bonus | Net Payable')

  for (const emp of employees) {
    if (emp.baseSalary === 0) continue
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date(emp.createdAt)
    const endDate = emp.employmentEndDate ? new Date(emp.employmentEndDate) : null
    const atts = await db.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: monthRange.from, lte: monthRange.to } },
      select: { date: true, status: true, checkIn: true, checkOut: true, lateMinutes: true, overtimeHours: true, overtimePay: true }
    })
    
    const joinDateStr = getLocalDateString(joinDate)
    const endDateStr = endDate ? getLocalDateString(endDate) : null
    const cutoffStr = getLocalDateString(monthRange.cutoffDate)
    const employeeLeaves = new Set(atts.filter(a => a.status === 'LEAVE').map(a => a.date))
    const eligibleDays = getEligibleWorkingDays(monthRange.year, monthRange.month, joinDate, endDate, holidaySet, monthRange.cutoffDate, employeeLeaves)
    
    if (eligibleDays === 0) continue

    let presentDays = 0, lateDays = 0, halfDays = 0, explicitAbsentDays = 0, leaveDays = 0, totalOvertimePay = 0, totalOvertimeHours = 0
    for (const a of atts) {
      if (!isRecordInValidEmploymentPeriod(a.date, joinDate, endDate)) continue
      if (a.date > cutoffStr) continue
      if (new Date(a.date).getDay() === 0) continue
      if (holidaySet.has(a.date)) continue
      switch (a.status) {
        case 'PRESENT': presentDays++; break
        case 'LATE': lateDays++; break
        case 'HALF_DAY': halfDays++; break
        case 'ABSENT': explicitAbsentDays++; break
        case 'LEAVE': leaveDays++; break
      }
      totalOvertimePay += a.overtimePay || 0
      totalOvertimeHours += a.overtimeHours || 0
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
    const attendancePercentage = (earnedAttendanceDays / eligibleDays) * 100
    const zone = classifyZone(Math.min(attendancePercentage, 100))
    const dailyWage = emp.baseSalary / eligibleDays
    const absentDeductionPerDay = emp.absentDeduction ?? dailyWage
    const totalDeduction = absentDays * absentDeductionPerDay
    const netPayable = emp.baseSalary - totalDeduction + totalOvertimePay
    const greenZoneBonus = zone === 'GREEN' ? emp.baseSalary * 0.05 : 0
    const finalNet = netPayable + greenZoneBonus

    console.log(`${emp.employeeId} | ${emp.name} | ${emp.department || '-'} | ${emp.baseSalary} | ${presentDays} | ${lateDays} | ${halfDays} | ${absentDays} | ${leaveDays} | ${eligibleDays} | ${earnedAttendanceDays.toFixed(1)} | ${attendancePercentage.toFixed(1)}% | ${zone} | ${totalDeduction.toFixed(2)} | ${totalOvertimeHours.toFixed(1)} | ${totalOvertimePay.toFixed(2)} | ${greenZoneBonus.toFixed(2)} | ${finalNet.toFixed(2)}`)
  }

  await db.$disconnect()
}

testPayrollAndExcel().catch(console.error)