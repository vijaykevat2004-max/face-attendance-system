import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { buildMonthlyReportRow, getWorkingDaysInMonth, formatCurrency, getISTParts, IST_TIME_ZONE } from '@/lib/salary'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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
      db.employee.findMany({
        where: { active: true },
        orderBy: { employeeId: 'asc' },
      }),
      db.attendance.findMany({
        where: { date: { gte: from, lte: to } },
        select: { employeeId: true, date: true, status: true, deduction: true, overtimeHours: true, overtimePay: true },
      }),
      db.setting.findMany(),
    ])

    const settings: Record<string, string> = {}
    for (const s of settingsRows) settings[s.key] = s.value
    const companyName = settings.companyName || 'Acme Workshop'
    const workingDays = getWorkingDaysInMonth(year, month)

    const rows = employees.map((emp) => {
      const empAtt = attendances.filter((a) => a.employeeId === emp.id)
      return buildMonthlyReportRow(
        {
          id: emp.id,
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department,
          baseSalary: emp.baseSalary,
          createdAt: emp.createdAt,
          absentDeduction: emp.absentDeduction,
        },
        empAtt,
        year,
        month,
      )
    })

    const totals = {
      payrollBase: rows.reduce((s, r) => s + r.baseSalary, 0),
      totalDeduction: rows.reduce((s, r) => s + r.totalDeduction, 0),
      totalOvertimePay: rows.reduce((s, r) => s + r.totalOvertimePay, 0),
      payable: rows.reduce((s, r) => s + r.payableSalary, 0),
    }

    const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const now = new Date()

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(companyName, 40, 40)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Monthly Salary Report — ${monthName}`, 40, 60)
    doc.setFontSize(9)
    doc.text(`Generated: ${now.toLocaleString('en-IN', { timeZone: IST_TIME_ZONE })}`, 40, 75)
    doc.text(`Working Days: ${workingDays}  |  Employees: ${rows.length}`, pageWidth - 200, 75)

    // Table
    autoTable(doc, {
      startY: 95,
      head: [['Emp ID', 'Name', 'Dept', 'Base', 'Present', 'Late', 'Half', 'Absent', 'Deduction', 'Overtime', 'Payable']],
      body: rows.map((r) => [
        r.employeeCode,
        r.name,
        r.department || '—',
        formatCurrency(r.baseSalary),
        r.presentDays,
        r.lateDays,
        r.halfDays,
        r.absentDays,
        formatCurrency(r.totalDeduction),
        formatCurrency(r.totalOvertimePay),
        formatCurrency(r.payableSalary),
      ]),
      foot: [[
        '', 'TOTAL', '', formatCurrency(totals.payrollBase),
        '', '', '', '',
        formatCurrency(totals.totalDeduction),
        formatCurrency(totals.totalOvertimePay),
        formatCurrency(totals.payable),
      ]],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      footStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
      },
      theme: 'striped',
    })

    // Footer
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 30
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(
      'This is a system-generated report. Deductions are based on configured late-arrival tiers and absence policy.',
      40,
      finalY,
    )

    const pdfBytes = doc.output('arraybuffer')
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="salary-report-${monthParam || `${year}-${String(month).padStart(2, '0')}`}.pdf"`,
      },
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
