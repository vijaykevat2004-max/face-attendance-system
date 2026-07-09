'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  FileSpreadsheet, FileText, Download, TrendingDown, Wallet, Users, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, getWorkingDaysInMonth } from '@/lib/salary'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface ReportRow {
  employeeId: string
  employeeCode: string
  name: string
  department: string | null
  baseSalary: number
  presentDays: number
  lateDays: number
  halfDays: number
  absentDays: number
  leaveDays: number
  totalDeduction: number
  payableSalary: number
  days?: Array<{
    date: string
    status: string
    checkIn: string | null
    checkOut: string | null
    lateMinutes: number
    workingHours: number
    deduction: number
  }>
}

interface ReportData {
  month: string
  year: number
  monthNumber: number
  workingDays: number
  employeeCount: number
  rows: ReportRow[]
  totals: {
    payrollBase: number
    totalDeduction: number
    payable: number
    presentDays: number
    lateDays: number
    halfDays: number
    absentDays: number
  }
}

export function Reports() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/monthly?month=${month}`)
      if (!res.ok) throw new Error('failed')
      const d = await res.json()
      setData(d)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const exportFile = async (format: 'pdf' | 'excel') => {
    setExporting(format)
    try {
      const res = await fetch(`/api/reports/export/${format}?month=${month}`)
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `salary-report-${month}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} exported`)
    } catch (e) {
      toast.error(`Failed to export ${format.toUpperCase()}`)
    } finally {
      setExporting(null)
    }
  }

  // Build month options (last 12 months)
  const monthOptions: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    monthOptions.push({ value: v, label })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" /> Salary Reports
          </h2>
          <p className="text-sm text-slate-500">Generate monthly payroll with automatic deductions and exports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportFile('pdf')} disabled={exporting !== null || !data}>
            <FileText className="h-4 w-4 mr-2" />
            {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
          </Button>
          <Button variant="outline" onClick={() => exportFile('excel')} disabled={exporting !== null || !data}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting === 'excel' ? 'Exporting…' : 'Excel'}
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">Total Payroll (Base)</p>
                    <p className="text-xl font-bold text-slate-900">{formatCurrency(data.totals.payrollBase)}</p>
                  </div>
                  <Wallet className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-xs text-slate-500 mt-1">{data.employeeCount} employees · {data.workingDays} working days</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-700 font-medium">Total Deductions</p>
                    <p className="text-xl font-bold text-red-900">{formatCurrency(data.totals.totalDeduction)}</p>
                  </div>
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-xs text-red-600 mt-1">{data.totals.lateDays} late · {data.totals.absentDays} absent · {data.totals.halfDays} half-day</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Net Payable</p>
                    <p className="text-xl font-bold text-emerald-900">{formatCurrency(data.totals.payable)}</p>
                  </div>
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  {((data.totals.payable / Math.max(1, data.totals.payrollBase)) * 100).toFixed(1)}% of base
                </p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Present Days</p>
                    <p className="text-xl font-bold text-blue-900">{data.totals.presentDays}</p>
                  </div>
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  of {data.workingDays * data.employeeCount} possible
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payable vs Deduction per Employee</CardTitle>
              <CardDescription>Visual breakdown of each employee&apos;s salary components for {data.month}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.rows.map((r) => ({
                  name: r.employeeCode,
                  Payable: Math.round(r.payableSalary),
                  Deduction: Math.round(r.totalDeduction),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="Payable" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Deduction" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Salary Breakdown — {data.month}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  No active employees for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Emp ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Dept</TableHead>
                        <TableHead className="text-right">Base</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Late</TableHead>
                        <TableHead className="text-center">Half</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-right">Deduction</TableHead>
                        <TableHead className="text-right">Payable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.employeeId}>
                          <TableCell className="font-mono text-xs">{r.employeeCode}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-slate-600">{r.department || '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.baseSalary)}</TableCell>
                          <TableCell className="text-center text-emerald-700 font-medium">{r.presentDays}</TableCell>
                          <TableCell className="text-center text-amber-700">{r.lateDays}</TableCell>
                          <TableCell className="text-center text-purple-700">{r.halfDays}</TableCell>
                          <TableCell className="text-center text-red-700">{r.absentDays}</TableCell>
                          <TableCell className="text-right text-red-600">{r.totalDeduction > 0 ? formatCurrency(r.totalDeduction) : '—'}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(r.payableSalary)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => exportFile('pdf')} disabled={exporting !== null}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            <Button variant="outline" onClick={() => exportFile('excel')} disabled={exporting !== null}>
              <Download className="h-4 w-4 mr-2" /> Download Excel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
