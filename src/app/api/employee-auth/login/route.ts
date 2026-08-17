import { NextRequest, NextResponse } from 'next/server'
import { verifyPin, createEmployeeSession, checkRateLimit, recordFailedAttempt, recordSuccess, isWeakPin } from '@/lib/employee-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, pin } = body as { employeeId?: string; pin?: string }

    if (!employeeId || !pin) {
      return NextResponse.json({ error: 'Employee ID and PIN are required' }, { status: 400 })
    }

    const normalizedEmployeeId = employeeId.trim().toUpperCase()

    // Rate limiting by IP + employeeId
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `${ip}:${normalizedEmployeeId}`
    const rateLimit = checkRateLimit(rateLimitKey)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter || 900) } }
      )
    }

    const result = await verifyPin(normalizedEmployeeId, pin)

    if (!result.valid) {
      recordFailedAttempt(rateLimitKey)
      // Generic error - don't reveal if employee ID exists
      return NextResponse.json({ error: 'Invalid Employee ID or PIN' }, { status: 401 })
    }

    recordSuccess(rateLimitKey)

    const session = await createEmployeeSession(result.employee!)

    return NextResponse.json({
      employee: {
        id: result.employee!.id,
        employeeId: result.employee!.employeeId,
        name: result.employee!.name,
        mustChangePin: result.employee!.mustChangePin,
      },
    })
  } catch (e: any) {
    console.error('Employee login error:', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}