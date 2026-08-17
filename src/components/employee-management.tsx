'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus, Search, UserPlus, Pencil, Trash2, Users, Loader2, CheckCircle2, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { FaceCapture } from './face-capture'
import { AttendanceCalendar, type CalendarDayData } from './attendance-calendar'
import { formatCurrency, formatDate, getISTParts, getLocalDateString, buildMonthCalendar } from '@/lib/salary'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface Employee {
  id: string
  employeeId: string
  name: string
  email: string | null
  phone: string | null
  department: string | null
  position: string | null
  baseSalary: number
  absentDeduction: number | null
  active: boolean
  faceImage: string | null
  bankAccountNumber: string | null
  bankIFSC: string | null
  bankAccountHolder: string | null
  joinDate: string | null
  employmentEndDate: string | null
  createdAt: string
}

interface FormState {
  employeeId: string
  name: string
  email: string
  phone: string
  department: string
  position: string
  baseSalary: string
  absentDeduction: string
  bankAccountNumber: string
  bankIFSC: string
  bankAccountHolder: string
  joinDate: string
  employmentEndDate: string
}

const EMPTY_FORM: FormState = {
  employeeId: '',
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  baseSalary: '15000',
  absentDeduction: '',
  bankAccountNumber: '',
  bankIFSC: '',
  bankAccountHolder: '',
  joinDate: '',
  employmentEndDate: '',
}

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null)
  const [faceImage, setFaceImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarEmployee, setCalendarEmployee] = useState<Employee | null>(null)
  const [calendarDays, setCalendarDays] = useState<CalendarDayData[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const istNow = getISTParts()
  const [calendarYear, setCalendarYear] = useState(istNow.year)
  const [calendarMonth, setCalendarMonth] = useState(istNow.month)

  const loadCalendar = async (emp: Employee, year: number, month: number) => {
    setCalendarLoading(true)
    try {
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const res = await fetch(`/api/attendance?employeeId=${emp.id}&from=${from}&to=${to}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const recorded = new Map<string, string>(data.records.map((r: any) => [r.date, r.status]))
      const joinDateStr = getLocalDateString(new Date(emp.createdAt))
      const days = buildMonthCalendar(joinDateStr, year, month, recorded)
      const detailByDate = new Map(data.records.map((r: any) => [r.date, r]))
      setCalendarDays(days.map((d) => ({
        ...d,
        checkIn: detailByDate.get(d.date)?.checkIn ?? null,
        checkOut: detailByDate.get(d.date)?.checkOut ?? null,
        overtimeHours: detailByDate.get(d.date)?.overtimeHours ?? 0,
      })))
    } catch (e) {
      toast.error('Failed to load calendar')
    } finally {
      setCalendarLoading(false)
    }
  }

  const openCalendar = (emp: Employee) => {
    setCalendarEmployee(emp)
    setCalendarYear(istNow.year)
    setCalendarMonth(istNow.month)
    setCalendarOpen(true)
    loadCalendar(emp, istNow.year, istNow.month)
  }

  const changeCalendarMonth = (delta: number) => {
    if (!calendarEmployee) return
    let newMonth = calendarMonth + delta
    let newYear = calendarYear
    if (newMonth < 1) { newMonth = 12; newYear -= 1 }
    if (newMonth > 12) { newMonth = 1; newYear += 1 }
    setCalendarYear(newYear)
    setCalendarMonth(newMonth)
    loadCalendar(calendarEmployee, newYear, newMonth)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees?all=${showInactive ? '1' : '0'}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setEmployees(data.employees)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, employeeId: suggestNextId(employees) })
    setFaceDescriptor(null)
    setFaceImage(null)
    setDialogOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setForm({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      position: emp.position || '',
      baseSalary: String(emp.baseSalary),
      absentDeduction: emp.absentDeduction != null ? String(emp.absentDeduction) : '',
      bankAccountNumber: emp.bankAccountNumber || '',
      bankIFSC: emp.bankIFSC || '',
      bankAccountHolder: emp.bankAccountHolder || '',
      joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : '',
      employmentEndDate: emp.employmentEndDate ? emp.employmentEndDate.split('T')[0] : '',
    })
    setFaceDescriptor(null)
    setFaceImage(emp.faceImage)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.employeeId || !form.name) {
      toast.error('Employee ID and Name are required')
      return
    }
    if (!editingId && !faceDescriptor) {
      toast.error('Please capture the employee\'s face before saving')
      return
    }
    if (form.joinDate && form.employmentEndDate && form.employmentEndDate < form.joinDate) {
      toast.error('Employment end date cannot be before joining date')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        employeeId: form.employeeId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        department: form.department,
        position: form.position,
        baseSalary: Number(form.baseSalary) || 0,
        absentDeduction: form.absentDeduction.trim() === '' ? null : Number(form.absentDeduction),
        bankAccountNumber: form.bankAccountNumber,
        bankIFSC: form.bankIFSC,
        bankAccountHolder: form.bankAccountHolder,
        joinDate: form.joinDate || null,
        employmentEndDate: form.employmentEndDate || null,
      }
      if (faceDescriptor) payload.faceDescriptor = faceDescriptor
      if (faceImage) payload.faceImage = faceImage

      const url = editingId ? `/api/employees/${editingId}` : '/api/employees'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save')
        return
      }
      toast.success(editingId ? 'Employee updated' : 'Employee enrolled successfully')
      setDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (emp: Employee) => {
    if (!confirm(`Deactivate employee ${emp.name}? Their attendance history will be preserved.`)) return
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      toast.success(`${emp.name} deactivated`)
      load()
    } catch {
      toast.error('Failed to deactivate')
    }
  }

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Employee Management
          </h2>
          <p className="text-sm text-slate-500">Register employees and enroll their facial data for check-in.</p>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="h-4 w-4 mr-2" /> Enroll Employee
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, ID, dept, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No employees found. Click &ldquo;Enroll Employee&rdquo; to add your first one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3 font-medium">Employee</th>
                    <th className="py-2 pr-3 font-medium">Contact</th>
                    <th className="py-2 pr-3 font-medium">Department</th>
                    <th className="py-2 pr-3 font-medium">Base Salary</th>
                    <th className="py-2 pr-3 font-medium">Join Date</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          {emp.faceImage ? (
                            <img
                              src={emp.faceImage}
                              alt={emp.name}
                              className="h-10 w-10 rounded-full object-cover bg-slate-100"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-medium">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{emp.name}</div>
                            <div className="text-xs text-slate-500">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        <div className="text-xs">{emp.email || '—'}</div>
                        <div className="text-xs text-slate-400">{emp.phone || ''}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="text-slate-700">{emp.department || '—'}</div>
                        <div className="text-xs text-slate-400">{emp.position || ''}</div>
                      </td>
                      <td className="py-3 pr-3 font-medium">{formatCurrency(emp.baseSalary)}</td>
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        {emp.joinDate ? formatDate(emp.joinDate) : formatDate(emp.createdAt)}
                      </td>
                      <td className="py-3 pr-3">
                        {emp.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openCalendar(emp)} title="View attendance calendar">
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(emp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(emp)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Employee' : 'Enroll New Employee'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update employee details and optionally re-capture face data.'
                : 'Fill in employee details and capture their face to enable check-in via face recognition.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="empId">Employee ID *</Label>
                  <Input
                    id="empId"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    disabled={!!editingId}
                    placeholder="EMP-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empName">Full Name *</Label>
                  <Input
                    id="empName"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="empEmail">Email</Label>
                  <Input
                    id="empEmail"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empPhone">Phone</Label>
                  <Input
                    id="empPhone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="empDept">Department</Label>
                  <Input
                    id="empDept"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="Production"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empPos">Position</Label>
                  <Input
                    id="empPos"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="Operator"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="empJoinDate">Joining Date</Label>
                  <Input
                    id="empJoinDate"
                    type="date"
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">Defaults to enrollment date if blank.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="empEndDate">Employment End Date</Label>
                  <Input
                    id="empEndDate"
                    type="date"
                    value={form.employmentEndDate}
                    onChange={(e) => setForm({ ...form, employmentEndDate: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">Leave blank for active employees.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empSalary">Monthly Base Salary (₹)</Label>
                <Input
                  id="empSalary"
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                  placeholder="15000"
                />
                <p className="text-xs text-slate-500">Daily wage = base salary ÷ working days in month (excl. Sundays).</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empAbsentDeduction">Absent Day Deduction (₹) — optional</Label>
                <Input
                  id="empAbsentDeduction"
                  type="number"
                  min="0"
                  value={form.absentDeduction}
                  onChange={(e) => setForm({ ...form, absentDeduction: e.target.value })}
                  placeholder={`Default: full daily wage (₹${(Number(form.baseSalary) / 26 || 0).toFixed(0)}/day)`}
                />
                <p className="text-xs text-slate-500">Leave blank to deduct this employee&apos;s full daily wage for every absent/no-show day. Set a custom amount to override it — including 0.</p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-600 mb-2">Bank Details (for payroll payout file)</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="empBankHolder">Account Holder Name</Label>
                    <Input
                      id="empBankHolder"
                      value={form.bankAccountHolder}
                      onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
                      placeholder="As per bank records"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="empBankAcc">Account Number</Label>
                      <Input
                        id="empBankAcc"
                        value={form.bankAccountNumber}
                        onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="empBankIfsc">IFSC Code</Label>
                      <Input
                        id="empBankIfsc"
                        value={form.bankIFSC}
                        onChange={(e) => setForm({ ...form, bankIFSC: e.target.value.toUpperCase() })}
                        placeholder="HDFC0001234"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {faceImage && (
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">
                    {faceDescriptor ? 'New face data captured' : 'Face data on file'}
                  </span>
                </div>
              )}
            </div>

            {/* Right: face capture */}
            <div>
              <FaceCapture
                onCapture={(desc, img) => {
                  setFaceDescriptor(desc)
                  setFaceImage(img)
                  toast.success('Face data captured')
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? 'Save Changes' : 'Enroll Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-md">
          {calendarEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>{calendarEmployee.name}</DialogTitle>
                <DialogDescription>{calendarEmployee.employeeId} · {calendarEmployee.department || 'No department'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => changeCalendarMonth(-1)} disabled={calendarLoading}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="font-medium text-sm">{MONTH_NAMES[calendarMonth - 1]} {calendarYear}</p>
                  <Button variant="outline" size="sm" onClick={() => changeCalendarMonth(1)} disabled={calendarLoading}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {calendarLoading ? (
                  <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></div>
                ) : (
                  <AttendanceCalendar year={calendarYear} month={calendarMonth} days={calendarDays} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function suggestNextId(employees: Employee[]): string {
  let max = 0
  for (const e of employees) {
    const m = e.employeeId.match(/EMP-(\d+)/i)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `EMP-${String(max + 1).padStart(3, '0')}`
}