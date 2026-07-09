import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export type SessionData = {
  adminId?: string
  username?: string
  name?: string
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || 'complex_password_at_least_32_characters_long_for_face_attendance_system_v1',
  cookieName: 'face-attendance-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session.adminId) {
    throw new Error('Unauthorized')
  }
  return session
}
