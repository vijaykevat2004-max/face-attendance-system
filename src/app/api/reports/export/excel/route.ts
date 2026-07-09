import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { buildMonthlyReportRow, getWorkingDaysInMonth, formatTime, getISTParts, IST_TIME_ZONE } from '@/lib/salary'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')

    const istNow = getISTParts()
    const year = monthParam ? Number(monthParam.split('-')[0]) : istNow.year
    const month = monthParam ? Number(monthParam.split('-')[1]) : istNow.month
    if (!year || !month) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [employees, attendances, settingsRows] = await Promise.all([
      db.employee.findMany({ where: { active: true }, orderBy: { employeeId: 'asc' } }),
      db.attendance.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          employeeId: true,
          date: true,
          status: true,
          deduction: true,
          checkIn: true,
          checkOut: true,
          lateMinutes: true,
          workingHours: true,
        },
      }),
      db.setting.findMany(),
    ])

    const settings: Record<string, string> = {}
    for (const s of settingsRows) settings[s.key] = s.value
    const companyName = settings.companyName || 'Acme Workshop'
    const workingDays = getWorkingDaysInMonth(year, month)
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const now = new Date()

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Face Attendance System'
    wb.created = now

    // Sheet 1: Summary
    const summary = wb.addWorksheet('Summary', {
      properties: { defaultColWidth: 16 },
    })

    summary.mergeCells('A1:J1')
    const titleCell = summary.getCell('A1')
    titleCell.value = `${companyName} — Monthly Salary Report (${monthName})`
    titleCell.font = { size: 16, bold: true }
    titleCell.alignment = { horizontal: 'center' }

    summary.mergeCells('A2:J2')
    const subCell = summary.getCell('A2')
    subCell.value = `Generated ${now.toLocaleString('en-IN', { timeZone: IST_TIME_ZONE })}  |  Working days: ${workingDays}  |  Employees: ${employees.length}`
    subCell.font = { size: 10, italic: true }
    subCell.alignment = { horizontal: 'center' }

    const headerRow = summary.addRow([
      'Emp ID', 'Name', 'Department', 'Base Salary',
      'Present', 'Late', 'Half Day', 'Absent', 'Total Deduction', 'Payable Salary',
    ])
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    headerRow.alignment = { horizontal: 'center' }
    headerRow.height = 22

    const rows = employees.map((emp) => {
      const empAtt = attendances.filter((a) => a.employeeId === emp.id)
      return buildMonthlyReportRow(
        { id: emp.id, employeeId: emp.employeeId, name: emp.name, department: emp.department, baseSalary: emp.baseSalary, createdAt: emp.createdAt, absentDeduction: emp.absentDeduction },
        empAtt,
        year,
        month,
      )
    })

    for (const r of rows) {
      const row = summary.addRow([
        r.employeeCode,
        r.name,
        r.department || '—',
        r.baseSalary,
        r.presentDays,
        r.lateDays,
        r.halfDays,
        r.absentDays,
        r.totalDeduction,
        r.payableSalary,
      ])
      row.getCell(4).numFmt = '"₹"#,##0'
      row.getCell(9).numFmt = '"₹"#,##0'
      row.getCell(10).numFmt = '"₹"#,##0'
      row.alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'left' }
    }

    // Totals row
    const totals = {
      payrollBase: rows.reduce((s, r) => s + r.baseSalary, 0),
      totalDeduction: rows.reduce((s, r) => s + r.totalDeduction, 0),
      payable: rows.reduce((s, r) => s + r.payableSalary, 0),
    }
    const totalsRow = summary.addRow([
      '', 'TOTAL', '', totals.payrollBase, '', '', '', '', totals.totalDeduction, totals.payable,
    ])
    totalsRow.font = { bold: true }
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    totalsRow.getCell(4).numFmt = '"₹"#,##0'
    totalsRow.getCell(9).numFmt = '"₹"#,##0'
    totalsRow.getCell(10).numFmt = '"₹"#,##0'

    // Freeze header
    summary.views = [{ state: 'frozen', ySplit: 3 }]

    // Sheet 2: Daily Detail
    const detail = wb.addWorksheet('Daily Detail', { properties: { defaultColWidth: 14 } })
    const detailHeader = detail.addRow([
      'Emp ID', 'Name', 'Date', 'Status', 'Check In', 'Check Out', 'Late (min)', 'Hours', 'Deduction',
    ])
    detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    detailHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    detailHeader.alignment = { horizontal: 'center' }

    for (const emp of employees) {
      const empAtt = attendances
        .filter((a) => a.employeeId === emp.id)
        .sort((a, b) => a.date.localeCompare(b.date))
      for (const a of empAtt) {
        const row = detail.addRow([
          emp.employeeId,
          emp.name,
          a.date,
          a.status,
          formatTime(a.checkIn),
          formatTime(a.checkOut),
          a.lateMinutes,
          a.workingHours,
          a.deduction,
        ])
        row.getCell(9).numFmt = '"₹"#,##0'
        row.alignment = { horizontal: 'center' }
        row.getCell(2).alignment = { horizontal: 'left' }
      }
    }
    detail.views = [{ state: 'frozen', ySplit: 1 }]

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="salary-report-${monthParam || `${year}-${String(month).padStart(2, '0')}`}.xlsx"`,
      },
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate Excel' }, { status: 500 })
  }
}
