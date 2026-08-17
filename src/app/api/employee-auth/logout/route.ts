import { NextResponse } from 'next/server'
import { destroyEmployeeSession } from '@/lib/employee-auth'

export const runtime = 'nodejs'

export async function POST() {
  try {
    await destroyEmployeeSession()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}