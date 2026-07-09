import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * APPROVED -> PAID. The admin calls this themselves AFTER they've actually
 * uploaded the payout file to their bank and confirmed the transfer there —
 * this endpoint never moves money, it only records that it happened.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const run = await db.payrollRun.findUnique({ where: { id } })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status !== 'APPROVED') {
      return NextResponse.json({ error: `Cannot mark as paid — run must be approved first (currently ${run.status.toLowerCase()})` }, { status: 409 })
    }

    const updated = await db.payrollRun.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paidBy: session.name || session.username || 'admin' },
    })
    return NextResponse.json({ run: updated })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to mark payroll run as paid' }, { status: 500 })
  }
}
