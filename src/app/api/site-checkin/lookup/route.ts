import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/site-checkin/lookup?code=EMP-001
 * Public endpoint used by the unauthenticated site check-in page.
 * Looks up exactly ONE employee by their human-friendly employeeId code and
 * returns just enough to run a 1:1 face verification on-device — never the
 * full employee/face-descriptor roster (that stays behind admin auth).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')?.trim()
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const emp = await db.employee.findUnique({ where: { employeeId: code } })
    if (!emp || !emp.active) {
      return NextResponse.json({ error: 'Employee code not found' }, { status: 404 })
    }

    return NextResponse.json({
      employee: {
        id: emp.id,
        employeeId: emp.employeeId,
        name: emp.name,
        department: emp.department,
        faceDescriptor: emp.faceDescriptor,
      },
    })
  } catch (e) {
    console.error('site-checkin lookup error', e)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
