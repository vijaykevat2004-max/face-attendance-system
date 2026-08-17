import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { DEFAULT_SHIFT, type ShiftSettings } from '@/lib/salary'

export const runtime = 'nodejs'

export async function GET() {
  const rows = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  const shift: ShiftSettings = {
    shiftStart: map.shiftStart || DEFAULT_SHIFT.shiftStart,
    shiftEnd: map.shiftEnd || DEFAULT_SHIFT.shiftEnd,
    halfDayAfterMinutes: Number(map.halfDayAfterMinutes || DEFAULT_SHIFT.halfDayAfterMinutes),
    absentAfterMinutes: Number(map.absentAfterMinutes || DEFAULT_SHIFT.absentAfterMinutes),
    standardWorkingHours: Number(map.standardWorkingHours || DEFAULT_SHIFT.standardWorkingHours),
    minCheckoutGapMinutes: Number(map.minCheckoutGapMinutes || DEFAULT_SHIFT.minCheckoutGapMinutes),
  }

  return NextResponse.json({
    shift,
    companyName: map.companyName || 'Acme Workshop',
    salaryDeductionEnabled: map.salaryDeductionEnabled === 'true',
  })
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { shift, companyName, salaryDeductionEnabled } = body as {
      shift?: Partial<ShiftSettings>
      companyName?: string
      salaryDeductionEnabled?: boolean
    }

    const updates: Record<string, string> = {}
    if (companyName !== undefined) updates.companyName = companyName
    if (salaryDeductionEnabled !== undefined) updates.salaryDeductionEnabled = String(salaryDeductionEnabled)
    if (shift) {
      if (shift.shiftStart) updates.shiftStart = shift.shiftStart
      if (shift.shiftEnd) updates.shiftEnd = shift.shiftEnd
      if (shift.halfDayAfterMinutes !== undefined) updates.halfDayAfterMinutes = String(shift.halfDayAfterMinutes)
      if (shift.absentAfterMinutes !== undefined) updates.absentAfterMinutes = String(shift.absentAfterMinutes)
      if (shift.standardWorkingHours !== undefined) updates.standardWorkingHours = String(shift.standardWorkingHours)
      if (shift.minCheckoutGapMinutes !== undefined) updates.minCheckoutGapMinutes = String(shift.minCheckoutGapMinutes)
    }

    for (const [k, v] of Object.entries(updates)) {
      await db.setting.upsert({
        where: { key: k },
        update: { value: v },
        create: { key: k, value: v },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}