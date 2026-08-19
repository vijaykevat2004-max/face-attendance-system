import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLocalDateString } from '@/lib/salary'

export const runtime = 'nodejs'

export async function GET() {
  try {
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
  } catch (e) {
    console.error('kiosk today error', e)
    return NextResponse.json({ error: 'Failed to fetch today data' }, { status: 500 })
  }
}
