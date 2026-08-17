import { NextResponse } from 'next/server'
import { requireEmployee } from '@/lib/employee-auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const employee = await requireEmployee()
    return NextResponse.json({ employee })
  } catch (e: any) {
    if (e?.message === 'Unauthorized' || e?.message === 'Session expired') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error(e)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}