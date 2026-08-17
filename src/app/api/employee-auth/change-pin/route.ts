import { NextRequest, NextResponse } from 'next/server'
import { requireEmployee, setPinHash, isWeakPin } from '@/lib/employee-auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee()
    const body = await req.json()
    const { currentPin, newPin, confirmPin } = body as {
      currentPin?: string
      newPin?: string
      confirmPin?: string
    }

    if (!currentPin || !newPin || !confirmPin) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (newPin !== confirmPin) {
      return NextResponse.json({ error: 'New PIN and confirmation do not match' }, { status: 400 })
    }

    if (isWeakPin(newPin)) {
      return NextResponse.json(
        { error: 'PIN is too weak. Use 6 digits, avoid patterns like 123456, 111111, etc.' },
        { status: 400 }
      )
    }

    // Verify current PIN
    const employee = await db.employee.findUnique({
      where: { id: session.employeeId },
      select: { employeePinHash: true },
    })

    if (!employee?.employeePinHash) {
      return NextResponse.json({ error: 'PIN not set' }, { status: 400 })
    }

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(currentPin, employee.employeePinHash)
    if (!valid) {
      return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 })
    }

    // Set new PIN
    await setPinHash(session.employeeId, newPin)

    // Refresh session to update mustChangePin flag
    const updatedEmployee = await db.employee.findUnique({
      where: { id: session.employeeId },
      select: { employeeMustChangePin: true, employeeSessionVersion: true },
    })

    return NextResponse.json({
      success: true,
      mustChangePin: updatedEmployee?.employeeMustChangePin ?? false,
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized' || e?.message === 'Session expired') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Change PIN error:', e)
    return NextResponse.json({ error: 'Failed to change PIN' }, { status: 500 })
  }
}