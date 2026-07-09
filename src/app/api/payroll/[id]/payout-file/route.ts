import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { decryptField } from '@/lib/crypto'

export const runtime = 'nodejs'

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * GET /api/payroll/[id]/payout-file — bank bulk-upload CSV.
 * Only available once a run is APPROVED or PAID — this is deliberately the
 * only place bank account numbers leave the app, and only an authenticated
 * admin can request it. Employees missing bank details are excluded and
 * listed separately so nothing silently fails.
 *
 * Column layout is a generic NEFT/RTGS bulk-payment format accepted by most
 * Indian bank corporate portals; check your bank's exact template before
 * uploading — some require extra columns (payment type, branch, etc).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const run = await db.payrollRun.findUnique({
      where: { id },
      include: { items: { orderBy: { employeeCode: 'asc' } } },
    })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status === 'DRAFT') {
      return NextResponse.json({ error: 'Approve this payroll run before downloading the payout file' }, { status: 409 })
    }

    const decrypted = run.items.map((i) => ({
      ...i,
      bankAccountNumber: decryptField(i.bankAccountNumber),
      bankIFSC: decryptField(i.bankIFSC),
      bankAccountHolder: decryptField(i.bankAccountHolder),
    }))
    const payable = decrypted.filter((i) => i.bankAccountNumber && i.bankIFSC && i.netPayable > 0)
    const skipped = decrypted.filter((i) => !i.bankAccountNumber || !i.bankIFSC)

    const headers = ['Beneficiary Account Number', 'IFSC Code', 'Beneficiary Name', 'Amount (INR)', 'Payment Mode', 'Employee Code', 'Narration']
    const lines = [headers.join(',')]
    for (const item of payable) {
      lines.push([
        csvCell(item.bankAccountNumber!),
        csvCell(item.bankIFSC!),
        csvCell(item.bankAccountHolder || item.employeeName),
        csvCell(item.netPayable.toFixed(2)),
        'NEFT',
        csvCell(item.employeeCode),
        csvCell(`Salary ${run.month}`),
      ].join(','))
    }
    if (skipped.length > 0) {
      lines.push('')
      lines.push(`# ${skipped.length} employee(s) skipped — missing bank details:`)
      for (const item of skipped) {
        lines.push(`# ${csvCell(item.employeeCode)},${csvCell(item.employeeName)}`)
      }
    }

    const csv = lines.join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payout-${run.month}.csv"`,
      },
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate payout file' }, { status: 500 })
  }
}
