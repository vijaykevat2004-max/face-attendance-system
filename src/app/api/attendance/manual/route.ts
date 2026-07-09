import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

const VALID_STATUSES = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE']

/**
 * POST /api/attendance/manual — admin creates or overrides a single day's
 * attendance record by hand (status + exact deduction amount), instead of
 * relying on the face-scan kiosk or the automatic no-show calculation.
 * Body: { employeeId, date: "YYYY-MM-DD", status, deduction, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin()
    const body = await req.json()
    const { employeeId, date, status, deduction, note } = body as {
      employeeId: string
      date: string
      status: string
      deduction: number
      note?: string
    }

    if (
      !employeeId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
      !VALID_STATUSES.includes(status) ||
      typeof deduction !== 'number' ||
      deduction < 0
    ) {
      return NextResponse.json(
        { error: 'employeeId, a valid YYYY-MM-DD date, a valid status, and a non-negative deduction are required' },
        { status: 400 },
      )
    }

    const emp = await db.employee.findUnique({ where: { id: employeeId } })
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const finalNote = note?.trim() || `Manually set by ${session.name || session.username}`
    const record = await db.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { status, deduction, note: finalNote, source: 'MANUAL' },
      create: { employeeId, date, status, deduction, note: finalNote, source: 'MANUAL' },
    })

    return NextResponse.json({ ok: true, attendance: record })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to save manual attendance entry' }, { status: 500 })
  }
}

/** DELETE /api/attendance/manual?employeeId=...&date=YYYY-MM-DD — remove an entry entirely. */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get('employeeId')
    const date = searchParams.get('date')
    if (!employeeId || !date) {
      return NextResponse.json({ error: 'employeeId and date are required' }, { status: 400 })
    }
    await db.attendance.deleteMany({ where: { employeeId, date } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete attendance entry' }, { status: 500 })
  }
}
