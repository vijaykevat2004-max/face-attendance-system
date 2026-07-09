import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { name, kind, minutesAfter, deduction, active } = body
    const rule = await db.attendanceRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(kind !== undefined && { kind }),
        ...(minutesAfter !== undefined && { minutesAfter: minutesAfter === null ? null : Number(minutesAfter) }),
        ...(deduction !== undefined && { deduction: Number(deduction) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    })
    return NextResponse.json({ rule })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.attendanceRule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
