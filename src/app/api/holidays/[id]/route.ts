import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { date, name, active } = body as { date?: string; name?: string; active?: boolean }

    const data: Record<string, unknown> = {}
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
      }
      const holidayDate = new Date(date)
      const existing = await db.holiday.findFirst({
        where: { date: holidayDate, NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'A holiday already exists for this date' }, { status: 409 })
      }
      data.date = holidayDate
    }
    if (name !== undefined) data.name = name
    if (active !== undefined) data.active = active

    const holiday = await db.holiday.update({ where: { id }, data })
    return NextResponse.json({ holiday })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.holiday.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}
