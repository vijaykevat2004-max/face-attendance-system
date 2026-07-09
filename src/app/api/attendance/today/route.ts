import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getLocalDateString } from '@/lib/salary'

export const runtime = 'nodejs'

/**
 * GET /api/attendance/today
 * Returns today's attendance for all active employees, including names and
 * face thumbnails — used by the Live Attendance tab and the kiosk dashboard,
 * both of which already sit behind admin login, so this requires it too.
 */
export async function GET(_req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dateStr = getLocalDateString()
  const records = await db.attendance.findMany({
    where: { date: dateStr },
    include: {
      employee: {
        select: { id: true, employeeId: true, name: true, department: true },
      },
    },
  })

  const employees = await db.employee.findMany({
    where: { active: true },
    select: {
      id: true,
      employeeId: true,
      name: true,
      department: true,
      position: true,
      faceImage: true,
    },
    orderBy: { name: 'asc' },
  })

  // Build a map for quick lookup
  const byEmp: Record<string, (typeof records)[number]> = {}
  for (const r of records) byEmp[r.employeeId] = r

  const rows = employees.map((e) => {
    const att = byEmp[e.id]
    return {
      employee: e,
      attendance: att
        ? {
            id: att.id,
            checkIn: att.checkIn,
            checkOut: att.checkOut,
            status: att.status,
            lateMinutes: att.lateMinutes,
            workingHours: att.workingHours,
            deduction: att.deduction,
            note: att.note,
          }
        : null,
    }
  })

  return NextResponse.json({ date: dateStr, rows })
}
