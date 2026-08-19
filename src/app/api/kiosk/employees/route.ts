import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const employees = await db.employee.findMany({
      where: { active: true },
      select: {
        id: true,
        employeeId: true,
        name: true,
        department: true,
        faceDescriptor: true,
        faceImage: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ employees })
  } catch (e) {
    console.error('kiosk employees error', e)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}
