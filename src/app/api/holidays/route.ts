import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const holidays = await db.holiday.findMany({
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        name: true,
        active: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ holidays })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { date, name, active } = body as { date: string; name: string; active?: boolean }

    if (!date || !name) {
      return NextResponse.json({ error: 'date and name are required' }, { status: 400 })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const holidayDate = new Date(date)
    const existing = await db.holiday.findUnique({ where: { date: holidayDate } })
    if (existing) {
      return NextResponse.json({ error: 'A holiday already exists for this date' }, { status: 409 })
    }

    const holiday = await db.holiday.create({
      data: {
        date: holidayDate,
        name,
        active: active !== undefined ? active : true,
      },
    })

    return NextResponse.json({ holiday })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}
