import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { generatePayrollForMonth } from '@/lib/payroll'

export const runtime = 'nodejs'

/**
 * GET /api/payroll — list all payroll runs (summary only, newest first)
 */
export async function GET() {
  try {
    await requireAdmin()
    const runs = await db.payrollRun.findMany({
      orderBy: { month: 'desc' },
    })
    return NextResponse.json({ runs })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch payroll runs' }, { status: 500 })
  }
}

/**
 * POST /api/payroll — generate (or regenerate, if still DRAFT) a payroll run for a month.
 * Body: { month: "YYYY-MM" }
 * Reuses the exact same salary calculation as the Salary Reports view, so the
 * numbers always match. Never touches money — this only produces a draft for
 * an admin to review and approve. (Also auto-runs monthly via cron — see
 * /api/cron/generate-payroll — this endpoint is for manual/on-demand use.)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { month } = body as { month: string }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month is required in YYYY-MM format' }, { status: 400 })
    }

    const result = await generatePayrollForMonth(month)
    if (result.skipped) {
      return NextResponse.json({ error: result.reason }, { status: 409 })
    }
    return NextResponse.json({ run: result.run })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 })
  }
}
