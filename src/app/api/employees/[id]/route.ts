import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { encryptField } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const {
      name, email, phone, department, position, baseSalary, absentDeduction, active, faceDescriptor, faceImage,
      bankAccountNumber, bankIFSC, bankAccountHolder, joinDate, employmentEndDate,
    } = body as {
      name?: string
      email?: string
      phone?: string
      department?: string
      position?: string
      baseSalary?: number
      absentDeduction?: number | null
      active?: boolean
      faceDescriptor?: number[]
      faceImage?: string
      bankAccountNumber?: string
      bankIFSC?: string
      bankAccountHolder?: string
      joinDate?: string | null
      employmentEndDate?: string | null
    }

    if (joinDate !== undefined && employmentEndDate !== undefined && joinDate && employmentEndDate && employmentEndDate < joinDate) {
      return NextResponse.json({ error: 'Employment end date cannot be before joining date' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email || null
    if (phone !== undefined) data.phone = phone || null
    if (department !== undefined) data.department = department || null
    if (position !== undefined) data.position = position || null
    if (baseSalary !== undefined) data.baseSalary = Number(baseSalary) || 0
    if (absentDeduction !== undefined) {
      data.absentDeduction = absentDeduction !== null && String(absentDeduction) !== '' ? Number(absentDeduction) : null
    }
    if (active !== undefined) data.active = Boolean(active)
    if (faceDescriptor !== undefined && Array.isArray(faceDescriptor)) {
      data.faceDescriptor = JSON.stringify(faceDescriptor)
    }
    if (faceImage !== undefined) data.faceImage = faceImage || null
    if (bankAccountNumber !== undefined) data.bankAccountNumber = encryptField(bankAccountNumber)
    if (bankIFSC !== undefined) data.bankIFSC = encryptField(bankIFSC ? bankIFSC.toUpperCase() : null)
    if (bankAccountHolder !== undefined) data.bankAccountHolder = encryptField(bankAccountHolder)
    if (joinDate !== undefined) data.joinDate = joinDate ? new Date(joinDate) : null
    if (employmentEndDate !== undefined) data.employmentEndDate = employmentEndDate ? new Date(employmentEndDate) : null

    const emp = await db.employee.update({ where: { id }, data })
    return NextResponse.json({ employee: { id: emp.id, name: emp.name } })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    // Soft-delete by deactivating (preserve attendance history)
    await db.employee.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}