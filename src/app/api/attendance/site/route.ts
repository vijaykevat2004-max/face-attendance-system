import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLocalDateString, formatTime, DEFAULT_SHIFT, type ShiftSettings } from '@/lib/salary'

export const runtime = 'nodejs'

/**
 * POST /api/attendance/site
 * Body: { employeeId, lat, lng, photo }
 * Public endpoint for the site check-in kiosk page. Face match against the
 * employee's enrolled descriptor happens client-side (1:1 verification) —
 * this endpoint just records the result. Marks the whole day PRESENT with
 * full standard working hours credited (site work hours aren't tracked
 * minute-by-minute like the workshop kiosk).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, lat, lng, photo } = body as {
      employeeId: string
      lat: number
      lng: number
      photo: string
    }

    if (!employeeId || typeof lat !== 'number' || typeof lng !== 'number' || !photo) {
      return NextResponse.json({ error: 'employeeId, lat, lng and photo are required' }, { status: 400 })
    }

    const emp = await db.employee.findUnique({ where: { id: employeeId } })
    if (!emp || !emp.active) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 })
    }

    const now = new Date()
    const dateStr = getLocalDateString(now)

    const existing = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
    })
    if (existing?.checkIn) {
      return NextResponse.json({
        ok: false,
        alreadyMarked: true,
        message: `${emp.name} is already marked ${existing.status.toLowerCase()} for today (${formatTime(existing.checkIn)}).`,
        attendance: existing,
      })
    }

    const settings = await db.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    const shift: ShiftSettings = {
      shiftStart: map.shiftStart || DEFAULT_SHIFT.shiftStart,
      shiftEnd: map.shiftEnd || DEFAULT_SHIFT.shiftEnd,
      halfDayAfterMinutes: Number(map.halfDayAfterMinutes || DEFAULT_SHIFT.halfDayAfterMinutes),
      absentAfterMinutes: Number(map.absentAfterMinutes || DEFAULT_SHIFT.absentAfterMinutes),
      standardWorkingHours: Number(map.standardWorkingHours || DEFAULT_SHIFT.standardWorkingHours),
      minCheckoutGapMinutes: Number(map.minCheckoutGapMinutes || DEFAULT_SHIFT.minCheckoutGapMinutes),
      overtimeMultiplier: Number(map.overtimeMultiplier ?? DEFAULT_SHIFT.overtimeMultiplier),
    }

    const record = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: dateStr } },
      update: {
        checkIn: now,
        checkOut: now,
        status: 'PRESENT',
        lateMinutes: 0,
        workingHours: shift.standardWorkingHours,
        deduction: 0,
        note: 'Marked present via site check-in',
        source: 'SITE',
        siteLat: lat,
        siteLng: lng,
        sitePhoto: photo,
      },
      create: {
        employeeId: emp.id,
        date: dateStr,
        checkIn: now,
        checkOut: now,
        status: 'PRESENT',
        lateMinutes: 0,
        workingHours: shift.standardWorkingHours,
        deduction: 0,
        note: 'Marked present via site check-in',
        source: 'SITE',
        siteLat: lat,
        siteLng: lng,
        sitePhoto: photo,
      },
    })

    return NextResponse.json({
      ok: true,
      employee: { id: emp.id, name: emp.name, employeeId: emp.employeeId },
      attendance: record,
      message: `${emp.name} marked present at site — ${formatTime(now)}`,
    })
  } catch (e) {
    console.error('site attendance POST error', e)
    return NextResponse.json({ error: 'Failed to record site attendance' }, { status: 500 })
  }
}
