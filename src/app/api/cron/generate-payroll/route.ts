import { NextRequest, NextResponse } from 'next/server'
import { generatePayrollForMonth } from '@/lib/payroll'
import { getISTParts } from '@/lib/salary'

export const runtime = 'nodejs'

/**
 * GET /api/cron/generate-payroll
 * Triggered automatically by Vercel Cron on the 1st of every month (see
 * vercel.json) to auto-generate a DRAFT payroll run for the month that just
 * ended — so it's already sitting there ready to review instead of the admin
 * having to remember to click "Generate". Never approves or pays anything;
 * that stays a manual step in the Payroll tab. Attendance tracking for the
 * new month needs no action here — the kiosk/site check-in keep recording it
 * as normal, and next month's cron run will pick it up the same way.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const istNow = getISTParts()
    // This runs on the 1st, so "last month" is the one whose payroll should now be finalized.
    const prevMonthDate = new Date(istNow.year, istNow.month - 2, 1)
    const year = prevMonthDate.getFullYear()
    const month = prevMonthDate.getMonth() + 1
    const monthStr = `${year}-${String(month).padStart(2, '0')}`

    const result = await generatePayrollForMonth(monthStr)
    return NextResponse.json({
      ok: true,
      month: monthStr,
      skipped: result.skipped,
      reason: result.reason,
      employeeCount: result.run.employeeCount,
      totalAmount: result.run.totalAmount,
    })
  } catch (e) {
    console.error('cron generate-payroll error', e)
    return NextResponse.json({ error: 'Failed to auto-generate payroll' }, { status: 500 })
  }
}
