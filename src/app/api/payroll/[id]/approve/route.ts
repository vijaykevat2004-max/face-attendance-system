import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

/** DRAFT -> APPROVED. This is the human-in-the-loop gate before any payout file can be produced. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    const { id } = await params
    const run = await db.payrollRun.findUnique({ where: { id } })
    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    if (run.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot approve — run is already ${run.status.toLowerCase()}` }, { status: 409 })
    }

    const updated = await db.payrollRun.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: session.name || session.username || 'admin' },
    })
    return NextResponse.json({ run: updated })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to approve payroll run' }, { status: 500 })
  }
}
