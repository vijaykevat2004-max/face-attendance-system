'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Calendar, Search, Download, RefreshCw, Pencil, PenLine, Loader2, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, formatCurrency, formatDate, getLocalDateString } from '@/lib/salary'

interface EmployeeOption {
  id: string
  employeeId: string
  name: string
}

interface ManualForm {
  employeeId: string
  date: string
  status: string
  deduction: string
  note: string
}

const EMPTY_MANUAL_FORM: ManualForm = {
  employeeId: '',
  date: getLocalDateString(),
  status: 'ABSENT',
  deduction: '0',
  note: '',
}

interface AttendanceRow {
  id: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  lateMinutes: number
  workingHours: number
  deduction: number
  note: string | null
  source: string
  employee: {
    id: string
    employeeId: string
    name: string
    department: string | null
    baseSalary: number
  }
}

export function AttendanceHistory() {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return getLocalDateString(d)
  })
  const [to, setTo] = useState(getLocalDateString())
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL_FORM)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualIsEdit, setManualIsEdit] = useState(false)

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?all=0')
      if (!res.ok) return
      const data = await res.json()
      setEmployees(data.employees.map((e: any) => ({ id: e.id, employeeId: e.employeeId, name: e.name })))
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const openManualEntry = (prefill?: { employeeId: string; date: string; status: string; deduction: number; note: string | null }) => {
    if (prefill) {
      setManualForm({
        employeeId: prefill.employeeId,
        date: prefill.date,
        status: prefill.status,
        deduction: String(prefill.deduction),
        note: prefill.note || '',
      })
      setManualIsEdit(true)
    } else {
      setManualForm(EMPTY_MANUAL_FORM)
      setManualIsEdit(false)
    }
    setManualOpen(true)
  }

  const submitManual = async () => {
    if (!manualForm.employeeId || !manualForm.date) {
      toast.error('Select an employee and date')
      return
    }
    const deduction = Number(manualForm.deduction)
    if (Number.isNaN(deduction) || deduction < 0) {
      toast.error('Deduction must be a non-negative number')
      return
    }
    setManualSaving(true)
    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: manualForm.employeeId,
          date: manualForm.date,
          status: manualForm.status,
          deduction,
          note: manualForm.note,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save')
        return
      }
      toast.success('Attendance entry saved')
      setManualOpen(false)
      load()
    } catch (e) {
      toast.error('Network error')
    } finally {
      setManualSaving(false)
    }
  }

  const deleteManual = async () => {
    if (!confirm('Delete this attendance entry? The day will then count as an automatic no-show absence if it has already passed.')) return
    setManualSaving(true)
    try {
      const params = new URLSearchParams({ employeeId: manualForm.employeeId, date: manualForm.date })
      const res = await fetch(`/api/attendance/manual?${params}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }
      toast.success('Entry deleted')
      setManualOpen(false)
      load()
    } catch (e) {
      toast.error('Network error')
    } finally {
      setManualSaving(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/attendance?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setRows(data.records)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load attendance records')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeId.toLowerCase().includes(q) ||
        (r.employee.department || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalDeduction = filtered.reduce((s, r) => s + (r.deduction || 0), 0)
  const totalHours = filtered.reduce((s, r) => s + (r.workingHours || 0), 0)
  const presentDays = filtered.filter((r) => r.status === 'PRESENT').length
  const lateDays = filtered.filter((r) => r.status === 'LATE').length

  const exportCsv = () => {
    const headers = ['Date', 'Emp ID', 'Name', 'Department', 'Check In', 'Check Out', 'Status', 'Source', 'Late (min)', 'Hours', 'Deduction']
    const lines = [headers.join(',')]
    for (const r of filtered) {
      lines.push([
        r.date,
        r.employee.employeeId,
        `"${r.employee.name}"`,
        `"${r.employee.department || ''}"`,
        r.checkIn ? formatTime(r.checkIn) : '',
        r.checkOut ? formatTime(r.checkOut) : '',
        r.status,
        r.source === 'SITE' ? 'Site' : 'Workshop',
        r.lateMinutes,
        r.workingHours.toFixed(2),
        r.deduction.toFixed(2),
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${from}_to_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" /> Attendance History
          </h2>
          <p className="text-sm text-slate-500">Browse, filter, and export attendance records across any date range.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => openManualEntry()} className="bg-emerald-600 hover:bg-emerald-700">
            <PenLine className="h-4 w-4 mr-2" /> Manual Entry
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        No-show days (no check-in of any kind) are now automatically counted as a full-day absence in salary reports and payroll. Use <strong>Manual Entry</strong> to override any specific day for any employee — e.g. mark it as paid Leave, or set a custom deduction amount instead of a full day's cut.
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="LATE">Late</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
                <SelectItem value="ABSENT">Absent</SelectItem>
                <SelectItem value="LEAVE">Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="search" className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                placeholder="Name / ID / dept"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 font-medium">Records</p>
            <p className="text-2xl font-bold text-emerald-900">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 font-medium">On-time Present</p>
            <p className="text-2xl font-bold text-blue-900">{presentDays}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 font-medium">Late Arrivals</p>
            <p className="text-2xl font-bold text-amber-900">{lateDays}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 font-medium">Total Deductions</p>
            <p className="text-2xl font-bold text-red-900">{formatCurrency(totalDeduction)}</p>
            <p className="text-xs text-red-500 mt-0.5">{totalHours.toFixed(0)}h logged</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No attendance records in this range.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm sticky-top">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Employee</th>
                    <th className="py-2 pr-3 font-medium">Dept</th>
                    <th className="py-2 pr-3 font-medium">Check In</th>
                    <th className="py-2 pr-3 font-medium">Check Out</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Late</th>
                    <th className="py-2 pr-3 font-medium">Hours</th>
                    <th className="py-2 pr-3 text-right font-medium">Deduction</th>
                    <th className="py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{r.employee.name}</div>
                        <div className="text-xs text-slate-500">{r.employee.employeeId}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{r.employee.department || '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.checkIn ? formatTime(r.checkIn) : '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                      <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.source === 'SITE' ? 'bg-orange-100 text-orange-700' : r.source === 'MANUAL' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.source === 'SITE' ? 'Site' : r.source === 'MANUAL' ? 'Manual' : 'Workshop'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{r.lateMinutes > 0 ? `${r.lateMinutes}m` : '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.workingHours > 0 ? r.workingHours.toFixed(2) : '—'}</td>
                      <td className="py-2 pr-3 text-right font-medium">
                        {r.deduction > 0 ? <span className="text-red-600">{formatCurrency(r.deduction)}</span> : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openManualEntry({ employeeId: r.employee.id, date: r.date, status: r.status, deduction: r.deduction, note: r.note })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{manualIsEdit ? 'Edit Attendance Entry' : 'Manual Attendance Entry'}</DialogTitle>
            <DialogDescription>
              Set the exact status and deduction for one employee on one day — this overrides any automatic calculation for that day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select
                value={manualForm.employeeId}
                onValueChange={(v) => setManualForm({ ...manualForm, employeeId: v })}
                disabled={manualIsEdit}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manualDate">Date</Label>
              <Input
                id="manualDate"
                type="date"
                value={manualForm.date}
                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                disabled={manualIsEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={manualForm.status} onValueChange={(v) => setManualForm({ ...manualForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LEAVE">Leave (paid, no deduction)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manualDeduction">Deduction Amount (₹)</Label>
              <Input
                id="manualDeduction"
                type="number"
                min="0"
                value={manualForm.deduction}
                onChange={(e) => setManualForm({ ...manualForm, deduction: e.target.value })}
              />
              <p className="text-xs text-slate-500">You decide the exact amount — e.g. 0 for an excused day, or the full/partial daily wage for an unexcused absence.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manualNote">Note (optional)</Label>
              <Textarea
                id="manualNote"
                value={manualForm.note}
                onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                placeholder="e.g. Approved sick leave"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {manualIsEdit && (
              <Button variant="outline" onClick={deleteManual} disabled={manualSaving} className="text-red-600 hover:text-red-700 mr-auto">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={submitManual} disabled={manualSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {manualSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESENT: { label: 'Present', cls: 'bg-emerald-100 text-emerald-700' },
    LATE: { label: 'Late', cls: 'bg-amber-100 text-amber-700' },
    HALF_DAY: { label: 'Half Day', cls: 'bg-purple-100 text-purple-700' },
    ABSENT: { label: 'Absent', cls: 'bg-red-100 text-red-700' },
    LEAVE: { label: 'Leave', cls: 'bg-blue-100 text-blue-700' },
  }
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-700' }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}
