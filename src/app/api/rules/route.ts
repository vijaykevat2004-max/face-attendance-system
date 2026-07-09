import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const rules = await db.attendanceRule.findMany({
    orderBy: [{ kind: 'asc' }, { minutesAfter: 'asc' }],
  })
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { name, kind, minutesAfter, deduction, active } = body as {
      name: string
      kind: string
      minutesAfter: number | null
      deduction: number
      active?: boolean
    }
    if (!name || !kind) {
      return NextResponse.json({ error: 'name and kind required' }, { status: 400 })
    }
    const rule = await db.attendanceRule.create({
      data: {
        name,
        kind,
        minutesAfter: minutesAfter === null ? null : Number(minutesAfter),
        deduction: Number(deduction) || 0,
        active: active ?? true,
      },
    })
    return NextResponse.json({ rule })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
