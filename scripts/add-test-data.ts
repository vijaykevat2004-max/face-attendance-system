import { PrismaClient } from '@prisma/client'
import { getISTParts, getLocalDateString } from '../src/lib/salary'

const db = new PrismaClient()

async function addTestData() {
  // Current IST date
  const ist = getISTParts()
  const year = ist.year
  const month = ist.month
  const daysInMonth = new Date(year, month, 0).getDate()
  
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  // Clear existing attendance for this month
  await db.attendance.deleteMany({
    where: { date: { gte: from, lte: to } }
  })
  console.log(`Cleared attendance for ${year}-${String(month).padStart(2, '0')}`)

  // Get all employees
  const employees = await db.employee.findMany({ 
    select: { id: true, employeeId: true, name: true, baseSalary: true, department: true, createdAt: true } 
  })

  console.log(`\nAdding test data for ${employees.length} employees...\n`)

  // Ensure salaryDeductionEnabled is OFF
  await db.setting.upsert({
    where: { key: 'salaryDeductionEnabled' },
    update: { value: 'false' },
    create: { key: 'salaryDeductionEnabled', value: 'false' }
  })
  console.log('salaryDeductionEnabled = false (deductions OFF)')

  for (const emp of employees) {
    const joinDate = new Date(emp.createdAt)
    const joinDateStr = getLocalDateString(joinDate)
    
    const attendances = []
    const today = new Date()
    const todayStr = getLocalDateString(today)
    const todayDay = today.getDate()
    
    console.log(`\n--- ${emp.name} (${emp.employeeId}) ---`)
    console.log(`  Base: ₹${emp.baseSalary}, Dept: ${emp.department || 'None'}, Join: ${joinDateStr}`)

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = new Date(year, month - 1, d).getDay()
      const isSunday = dayOfWeek === 0
      const isFuture = d > todayDay
      const isToday = d === todayDay
      
      // Skip if before join date
      if (dateStr < joinDateStr) continue

      let status: 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' = 'PRESENT'
      let checkIn: Date | null = null
      let checkOut: Date | null = null
      let lateMinutes = 0
      let workingHours = 0
      let overtimeHours = 0
      let overtimePay = 0
      let source = 'WORKSHOP'

      if (isFuture) {
        continue // Don't add future dates yet
      }

      if (isSunday) {
        // Sunday - no attendance record needed (will be implicit)
        continue
      }

      // Employee-specific patterns
      if (emp.employeeId === 'EMP-010') { // mahendra - 100% PRESENT (GREEN)
        status = 'PRESENT'
        checkIn = new Date(`${dateStr}T09:00:00`)
        checkOut = new Date(`${dateStr}T18:00:00`)
        workingHours = 9
        if (d % 4 === 0) { overtimeHours = 2; overtimePay = 2 * (emp.baseSalary / 26 / 8) * 1.5 }
      } else if (emp.employeeId === 'EMP-011') { // NIKHIL - 95% PRESENT (GREEN)
        if (d % 10 === 0) { status = 'ABSENT' } 
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-009') { // VIJAY KEVAT - 90% PRESENT (GREEN)
        if (d % 8 === 0) { status = 'LATE'; checkIn = new Date(`${dateStr}T09:30:00`); checkOut = new Date(`${dateStr}T18:00:00`); lateMinutes = 30; workingHours = 8.5 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-012') { // daxesh - 85% PRESENT, some LATE (GREEN)
        if (d % 7 === 0) { status = 'ABSENT' }
        else if (d % 5 === 0) { status = 'LATE'; checkIn = new Date(`${dateStr}T09:45:00`); checkOut = new Date(`${dateStr}T18:00:00`); lateMinutes = 45; workingHours = 8.25 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-013') { // sachin - 80% PRESENT, some LATE (GREEN/BLUE border)
        if (d % 6 === 0) { status = 'ABSENT' }
        else if (d % 4 === 0) { status = 'LATE'; checkIn = new Date(`${dateStr}T10:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); lateMinutes = 60; workingHours = 8 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-014') { // vikas - 70% (BLUE)
        if (d % 4 === 0) { status = 'ABSENT' }
        else if (d % 3 === 0) { status = 'LATE'; checkIn = new Date(`${dateStr}T10:15:00`); checkOut = new Date(`${dateStr}T18:00:00`); lateMinutes = 75; workingHours = 7.75 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-015') { // hira - 65% (RED)
        if (d % 3 === 0) { status = 'ABSENT' }
        else if (d % 4 === 0) { status = 'LATE'; checkIn = new Date(`${dateStr}T10:30:00`); checkOut = new Date(`${dateStr}T18:00:00`); lateMinutes = 90; workingHours = 7.5 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-016') { // suman - 60% (RED)
        if (d % 2 === 0) { status = 'ABSENT' }
        else if (d % 5 === 0) { status = 'HALF_DAY'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T13:00:00`); workingHours = 4 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-017') { // kajal - 95% with some HALF_DAY (GREEN)
        if (d % 12 === 0) { status = 'HALF_DAY'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T13:00:00`); workingHours = 4 }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-020') { // arjun - 75% with LEAVE days (BLUE)
        if (d % 5 === 0) { status = 'LEAVE' }
        else if (d % 6 === 0) { status = 'ABSENT' }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-018') { // ashish - 50% (RED)
        if (d % 2 === 0) { status = 'ABSENT' }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-019') { // aniket - 80% (GREEN)
        if (d % 5 === 0) { status = 'ABSENT' }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      } else if (emp.employeeId === 'EMP-021') { // VIJAY KEVAT (new hire) - only from 17th
        if (d >= 17) { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
        else { continue }
      } else { // Others - 85% present
        if (d % 7 === 0) { status = 'ABSENT' }
        else { status = 'PRESENT'; checkIn = new Date(`${dateStr}T09:00:00`); checkOut = new Date(`${dateStr}T18:00:00`); workingHours = 9 }
      }

      // Add some missing checkouts (5% of present days)
      if (status === 'PRESENT' && Math.random() < 0.05) {
        checkOut = null
      }

      // Add overtime for some employees on specific days
      if (status === 'PRESENT' && d % 5 === 0 && emp.baseSalary >= 15000) {
        overtimeHours = 2
        overtimePay = 2 * (emp.baseSalary / 26 / 8) * 1.5
      }

      attendances.push({
        employeeId: emp.id,
        date: dateStr,
        status,
        checkIn,
        checkOut,
        lateMinutes,
        workingHours,
        deduction: 0, // toggle is OFF
        source,
        overtimeHours,
        overtimePay,
      })
    }

    if (attendances.length > 0) {
      await db.attendance.createMany({ data: attendances })
      console.log(`  ✓ Added ${attendances.length} records`)
    } else {
      console.log(`  - No records (joined after month end or new hire not yet started)`)
    }
  }

  console.log('\n=== TEST DATA ADDED SUCCESSFULLY ===')
  console.log('\nTest scenarios covered:')
  console.log('✓ GREEN zone: EMP-010 (100%), EMP-011 (95%), EMP-009 (90%), EMP-012 (85%), EMP-017 (95%)')
  console.log('✓ BLUE zone:  EMP-013 (80%), EMP-014 (70%), EMP-020 (75% with LEAVE)')
  console.log('✓ RED zone:   EMP-015 (65%), EMP-016 (60%), EMP-018 (50%)')
  console.log('✓ NOT_RATED:  New hires (EMP-021..025 joined after 17th)')
  console.log('✓ LATE arrivals: Various employees with 30-90 min late')
  console.log('✓ HALF_DAY:   EMP-016, EMP-017')
  console.log('✓ LEAVE:      EMP-020 (every 5th day)')
  console.log('✓ MISSING CHECKOUT: ~5% of present days')
  console.log('✓ OVERTIME:   Every 5th day for salary >= 15000 (2h @ 1.5x)')
  console.log('✓ DEDUCTIONS: OFF (salaryDeductionEnabled = false)')

  await db.$disconnect()
}

addTestData().catch(console.error)