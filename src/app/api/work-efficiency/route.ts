import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getWorkEfficiencyData, parseMonthParam } from '@/lib/attendance-statistics'
import { timeStringToMinutes, DEFAULT_SHIFT } from '@/lib/salary'

export const runtime = 'nodejs'

async function getShiftSettings() {
  const settings = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value

  return {
    shiftStart: map.shiftStart || DEFAULT_SHIFT.shiftStart,
    shiftEnd: map.shiftEnd || DEFAULT_SHIFT.shiftEnd,
    halfDayAfterMinutes: Number(map.halfDayAfterMinutes || DEFAULT_SHIFT.halfDayAfterMinutes),
    absentAfterMinutes: Number(map.absentAfterMinutes || DEFAULT_SHIFT.absentAfterMinutes),
    standardWorkingHours: Number(map.standardWorkingHours || DEFAULT_SHIFT.standardWorkingHours),
    minCheckoutGapMinutes: Number(map.minCheckoutGapMinutes || DEFAULT_SHIFT.minCheckoutGapMinutes),
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const department = searchParams.get('department') || undefined

    // Validate month parameter - reject invalid formats
    if (month) {
      const parsed = parseMonthParam(month)
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid month parameter. Use YYYY-MM format with month between 01 and 12.' },
          { status: 400 },
        )
      }
    }

    const shiftSettings = await getShiftSettings()
    const { summary, employees } = await getWorkEfficiencyData(month ?? undefined, department, shiftSettings)

    return NextResponse.json({
      month: month || new Date().toISOString().slice(0, 7),
      department: department || null,
      summary,
      employees,
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (e?.message?.includes('Invalid month')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('Work Efficiency API error:', e)
    return NextResponse.json({ error: 'Failed to generate work efficiency report' }, { status: 500 })
  }
}