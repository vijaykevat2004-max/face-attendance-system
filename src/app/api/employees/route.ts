import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { encryptField, decryptField } from '@/lib/crypto'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('all') === '1'
    const withDescriptor = searchParams.get('withDescriptor') === '1'

    const employees = await db.employee.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        department: true,
        position: true,
        baseSalary: true,
        absentDeduction: true,
        active: true,
        faceImage: true,
        bankAccountNumber: true,
        bankIFSC: true,
        bankAccountHolder: true,
        joinDate: true,
        employmentEndDate: true,
        createdAt: true,
        ...(withDescriptor ? { faceDescriptor: true } : {}),
      },
    })
    const decrypted = employees.map((e) => ({
      ...e,
      bankAccountNumber: decryptField(e.bankAccountNumber),
      bankIFSC: decryptField(e.bankIFSC),
      bankAccountHolder: decryptField(e.bankAccountHolder),
    }))
    return NextResponse.json({ employees: decrypted })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const {
      employeeId, name, email, phone, department, position, baseSalary, absentDeduction, faceDescriptor, faceImage,
      bankAccountNumber, bankIFSC, bankAccountHolder, joinDate, employmentEndDate,
    } = body as {
      employeeId: string
      name: string
      email?: string
      phone?: string
      department?: string
      position?: string
      baseSalary?: number
      absentDeduction?: number | null
      faceDescriptor: number[]
      faceImage?: string
      bankAccountNumber?: string
      bankIFSC?: string
      bankAccountHolder?: string
      joinDate?: string
      employmentEndDate?: string
    }

    if (!employeeId || !name || !faceDescriptor || !Array.isArray(faceDescriptor)) {
      return NextResponse.json({ error: 'employeeId, name and faceDescriptor are required' }, { status: 400 })
    }

    if (joinDate && employmentEndDate && employmentEndDate < joinDate) {
      return NextResponse.json({ error: 'Employment end date cannot be before joining date' }, { status: 400 })
    }

    // Ensure unique employeeId
    const exists = await db.employee.findUnique({ where: { employeeId } })
    if (exists) {
      return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 })
    }

    const emp = await db.employee.create({
      data: {
        employeeId,
        name,
        email: email || null,
        phone: phone || null,
        department: department || null,
        position: position || null,
        baseSalary: Number(baseSalary) || 0,
        absentDeduction: absentDeduction !== undefined && absentDeduction !== null && String(absentDeduction) !== '' ? Number(absentDeduction) : null,
        faceDescriptor: JSON.stringify(faceDescriptor),
        faceImage: faceImage || null,
        bankAccountNumber: encryptField(bankAccountNumber),
        bankIFSC: encryptField(bankIFSC ? bankIFSC.toUpperCase() : null),
        bankAccountHolder: encryptField(bankAccountHolder),
        joinDate: joinDate ? new Date(joinDate) : null,
        employmentEndDate: employmentEndDate ? new Date(employmentEndDate) : null,
      },
    })

    return NextResponse.json({
      employee: {
        id: emp.id,
        employeeId: emp.employeeId,
        name: emp.name,
      },
    })
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}