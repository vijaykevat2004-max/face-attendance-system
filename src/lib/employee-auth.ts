import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export interface EmployeeSessionData {
  employeeId?: string
  employeeCode?: string
  name?: string
  mustChangePin?: boolean
  sessionVersion?: number
}

export const employeeSessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || 'complex_password_at_least_32_characters_long_for_face_attendance_system_v1',
  cookieName: 'employee-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}

export async function getEmployeeSession() {
  const session = await getIronSession<EmployeeSessionData>(await cookies(), employeeSessionOptions)
  return session
}

export async function requireEmployee() {
  const session = await getEmployeeSession()
  if (!session.employeeId) {
    throw new Error('Unauthorized')
  }
  // Verify employee still exists, is active, portal enabled, and session version matches
  const employee = await db.employee.findUnique({
    where: { id: session.employeeId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      active: true,
      employeePortalEnabled: true,
      employeeSessionVersion: true,
      employeeMustChangePin: true,
    },
  })
  if (!employee || !employee.active || !employee.employeePortalEnabled) {
    throw new Error('Unauthorized')
  }
  if (employee.employeeSessionVersion !== session.sessionVersion) {
    throw new Error('Session expired')
  }
  return {
    employeeId: employee.id,
    employeeCode: employee.employeeId,
    name: employee.name,
    mustChangePin: employee.employeeMustChangePin,
    sessionVersion: employee.employeeSessionVersion,
  }
}

export async function createEmployeeSession(employee: {
  id: string
  employeeId: string
  name: string
  mustChangePin: boolean
  sessionVersion: number
}) {
  const session = await getEmployeeSession()
  session.employeeId = employee.id
  session.employeeCode = employee.employeeId
  session.name = employee.name
  session.mustChangePin = employee.mustChangePin
  session.sessionVersion = employee.sessionVersion
  await session.save()
  return session
}

export async function destroyEmployeeSession() {
  const session = await getEmployeeSession()
  await session.destroy()
}

export async function verifyPin(employeeId: string, pin: string): Promise<{ valid: boolean; employee?: any }> {
  const employee = await db.employee.findUnique({
    where: { employeeId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      active: true,
      employeePortalEnabled: true,
      employeePinHash: true,
      employeeMustChangePin: true,
      employeeSessionVersion: true,
    },
  })

  if (!employee || !employee.active || !employee.employeePortalEnabled || !employee.employeePinHash) {
    return { valid: false }
  }

  const valid = await bcrypt.compare(pin, employee.employeePinHash)
  if (!valid) {
    return { valid: false }
  }

  return {
    valid: true,
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      mustChangePin: employee.employeeMustChangePin,
      sessionVersion: employee.employeeSessionVersion,
    },
  }
}

export async function setPinHash(employeeId: string, pin: string) {
  const hash = await bcrypt.hash(pin, 12)
  await db.employee.update({
    where: { id: employeeId },
    data: {
      employeePinHash: hash,
      employeeMustChangePin: false,
      employeeSessionVersion: { increment: 1 },
    },
  })
}

export async function resetPinByAdmin(employeeId: string): Promise<string> {
  // Generate a secure random 6-digit PIN
  const pin = Math.floor(100000 + Math.random() * 900000).toString()
  const hash = await bcrypt.hash(pin, 12)
  await db.employee.update({
    where: { id: employeeId },
    data: {
      employeePinHash: hash,
      employeeMustChangePin: true,
      employeeSessionVersion: { increment: 1 },
    },
  })
  return pin
}

export async function revokeEmployeeSessions(employeeId: string) {
  await db.employee.update({
    where: { id: employeeId },
    data: { employeeSessionVersion: { increment: 1 } },
  })
}

export function isWeakPin(pin: string): boolean {
  if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return true
  }
  const weakPins = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '111111', '000001', '123123']
  return weakPins.includes(pin)
}

const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>()

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = loginAttempts.get(identifier)

  if (record) {
    if (record.lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) }
    }
    if (record.count >= 5) {
      // Lock for 15 minutes after 5 failed attempts
      record.lockedUntil = now + 15 * 60 * 1000
      loginAttempts.set(identifier, record)
      return { allowed: false, retryAfter: 15 * 60 }
    }
  }
  return { allowed: true }
}

export function recordFailedAttempt(identifier: string) {
  const now = Date.now()
  const record = loginAttempts.get(identifier) || { count: 0, lastAttempt: now, lockedUntil: 0 }
  record.count += 1
  record.lastAttempt = now
  loginAttempts.set(identifier, record)
}

export function recordSuccess(identifier: string) {
  loginAttempts.delete(identifier)
}