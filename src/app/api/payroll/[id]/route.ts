import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { decryptField } from '@/lib/crypto'

export const runtime = 'nodejs'

// Only the last 4 digits ever need to reach the browser for display — the
// full account number stays server-side except in the payout file itself.
function maskAccount(encrypted: string | null): string | null {
  const plain = decryptField(encrypted)
  if (!plain) return null
  return plain.length <= 4 ? plain : `••••${plain.slice(-4)}`
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const run = await db.payrollRun.findUnique({
      where: { id },
      include: { items: { orderBy: { employeeCode: 'asc' } } },
    })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    const items = run.items.map((item) => ({
      ...item,
      bankAccountNumber: maskAccount(item.bankAccountNumber),
      bankIFSC: decryptField(item.bankIFSC),
      bankAccountHolder: decryptField(item.bankAccountHolder),
    }))
    return NextResponse.json({ run: { ...run, items } })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch payroll run' }, { status: 500 })
  }
}

/** Only DRAFT runs can be deleted — once approved/paid, a payroll record is kept for audit purposes. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const run = await db.payrollRun.findUnique({ where: { id } })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only draft payroll runs can be deleted' }, { status: 409 })
    }
    await db.payrollRun.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete payroll run' }, { status: 500 })
  }
}
