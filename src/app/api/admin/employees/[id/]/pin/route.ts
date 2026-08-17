import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { resetPinByAdmin, revokeEmployeeSessions } from '@/lib/employee-auth'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await context.params
    const body = await req.json()
    const { action } = body as { action: 'generate' | 'revoke' | 'disable' | 'enable' }

    const employee = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        name: true,
        employeePinHash: true,
        employeeMustChangePin: true,
        employeePortalEnabled: true,
        employeeSessionVersion: true,
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    switch (action) {
      case 'generate': {
        // Generate new temporary PIN
        const pin = await resetPinByAdmin(id)
        return NextResponse.json({
          success: true,
          temporaryPin: pin,
          message: 'Temporary PIN generated. Share this with the employee immediately - it will not be shown again.',
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            name: employee.name,
            mustChangePin: true,
            portalEnabled: true,
          },
        })
      }

      case 'revoke': {
        // Revoke all employee sessions (increment session version)
        await revokeEmployeeSessions(id)
        return NextResponse.json({
          success: true,
          message: 'All employee sessions revoked. Employee will need to log in again.',
        })
      }

      case 'disable': {
        // Disable portal access
        await db.employee.update({
          where: { id },
          data: { employeePortalEnabled: false, employeeSessionVersion: { increment: 1 } },
        })
        return NextResponse.json({
          success: true,
          message: 'Employee portal access disabled.',
        })
      }

      case 'enable': {
        // Enable portal access
        await db.employee.update({
          where: { id },
          data: { employeePortalEnabled: true },
        })
        return NextResponse.json({
          success: true,
          message: 'Employee portal access enabled.',
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (e: any) {
    if (e?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Admin PIN management error:', e)
    return NextResponse.json({ error: 'Failed to manage PIN' }, { status: 500 })
  }
}