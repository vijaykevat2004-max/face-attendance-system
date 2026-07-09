import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const admin = await db.admin.findUnique({ where: { username } })
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password || '', admin.passwordHash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const session = await getSession()
    session.adminId = admin.id
    session.username = admin.username
    session.name = admin.name
    await session.save()

    return NextResponse.json({ ok: true, admin: { id: admin.id, username: admin.username, name: admin.name } })
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
