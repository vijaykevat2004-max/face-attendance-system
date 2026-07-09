import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getLocalDateString } from '@/lib/salary'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const dateStr = getLocalDateString()

    const [totalEmployees, activeEmployees, todayRecords] = await Promise.all([
      db.employee.count(),
      db.employee.count({ where: { active: true } }),
      db.attendance.findMany({
        where: { date: dateStr },
        include: {
          employee: {
            select: { id: true, employeeId: true, name: true, department: true },
          },
        },
      }),
    ])

    const presentCount = todayRecords.filter((r) => r.checkIn).length
    const lateCount = todayRecords.filter((r) => r.status === 'LATE').length
    const absentCount = Math.max(0, activeEmployees - presentCount)
    const checkedOutCount = todayRecords.filter((r) => r.checkOut).length

    // Last 7 days trend
    const trend: Array<{ date: string; present: number; late: number; absent: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = getLocalDateString(d)
      const recs = await db.attendance.findMany({ where: { date: ds } })
      const p = recs.filter((r) => r.checkIn).length
      const l = recs.filter((r) => r.status === 'LATE').length
      const a = Math.max(0, activeEmployees - p)
      trend.push({ date: ds, present: p, late: l, absent: a })
    }

    // Department breakdown
    const deptBreakdown: Record<string, number> = {}
    for (const r of todayRecords) {
      if (r.checkIn) {
        const d = r.employee.department || 'Unassigned'
        deptBreakdown[d] = (deptBreakdown[d] || 0) + 1
      }
    }

    return NextResponse.json({
      date: dateStr,
      totals: {
        totalEmployees,
        activeEmployees,
        presentToday: presentCount,
        lateToday: lateCount,
        absentToday: absentCount,
        checkedOutToday: checkedOutCount,
      },
      trend,
      deptBreakdown,
      todayRecords: todayRecords.map((r) => ({
        id: r.id,
        employee: r.employee,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
        lateMinutes: r.lateMinutes,
        workingHours: r.workingHours,
        deduction: r.deduction,
        note: r.note,
      })),
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
