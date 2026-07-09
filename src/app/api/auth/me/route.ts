import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getSession()
  if (!session.adminId) {
    return NextResponse.json({ authenticated: false })
  }
  return NextResponse.json({
    authenticated: true,
    admin: { id: session.adminId, username: session.username, name: session.name },
  })
}
