'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AttendanceCalendar, type CalendarDayData } from './attendance-calendar'
import {
  Calendar, Loader2, AlertCircle, AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, ScanFace, LogOut,
} from 'lucide-react'
import { getISTParts } from '@/lib/salary'

interface EmployeeInfo {
  id: string
  employeeId: string
  name: string
  department: string | null
}

interface Summary {
  present: number
  late: number
  halfDay: number
  absent: number
  leave: number
  overtimeHours: number
}

interface AttendanceWarning {
  level: 'warning' | 'critical'
  reasons: string[]
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function MyAttendanceFlow() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null)
  const [days, setDays] = useState<CalendarDayData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [warning, setWarning] = useState<AttendanceWarning | null>(null)
  const istNow = getISTParts()
  const [year, setYear] = useState(istNow.year)
  const [month, setMonth] = useState(istNow.month)

  const load = async (empCode: string, y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/my-attendance?code=${encodeURIComponent(empCode)}&month=${y}-${String(m).padStart(2, '0')}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Employee code not found')
        setEmployee(null)
        return
      }
      setEmployee(data.employee)
      setDays(data.days)
      setSummary(data.summary)
      setWarning(data.warning ?? null)
      setYear(data.year)
      setMonth(data.month)
    } catch (e) {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const submit = () => {
    if (!code.trim()) return
    load(code.trim(), year, month)
  }

  const changeMonth = (delta: number) => {
    if (!employee) return
    let newMonth = month + delta
    let newYear = year
    if (newMonth < 1) { newMonth = 12; newYear -= 1 }
    if (newMonth > 12) { newMonth = 1; newYear += 1 }
    load(employee.employeeId, newYear, newMonth)
  }

  const reset = () => {
    setEmployee(null)
    setCode('')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-sm mx-auto">
            <Calendar className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-sm text-slate-500">Realize Group Attendance System</p>
        </div>

        {!employee ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enter Your Employee Code</CardTitle>
              <CardDescription>e.g. EMP-001 — ask your admin if you don't know it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Employee Code</Label>
                <Input
                  id="code"
                  autoFocus
                  placeholder="EMP-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {error}
                </div>
              )}
              <Button onClick={submit} disabled={loading || !code.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                View My Attendance
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{employee.name}</CardTitle>
                  <CardDescription>{employee.employeeId} · {employee.department || 'No department'}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" /> Exit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => changeMonth(-1)} disabled={loading}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="font-medium text-sm">{MONTH_NAMES[month - 1]} {year}</p>
                <Button variant="outline" size="sm" onClick={() => changeMonth(1)} disabled={loading}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {loading ? (
                <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></div>
              ) : (
                <>
                  {warning && <AttendanceWarningBanner warning={warning} />}

                  <AttendanceCalendar year={year} month={month} days={days} />

                  {summary && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <SummaryTile label="Present" value={summary.present} color="text-emerald-600" />
                      <SummaryTile label="Late/Half" value={summary.late + summary.halfDay} color="text-amber-600" />
                      <SummaryTile label="Absent" value={summary.absent} color="text-red-600" />
                      <SummaryTile label="Leave" value={summary.leave} color="text-blue-600" />
                      <SummaryTile label="Overtime" value={`${summary.overtimeHours.toFixed(1)}h`} color="text-teal-600" />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <ScanFace className="h-3 w-3" /> View-only — no salary or bank details shown here
        </p>
      </div>
    </div>
  )
}

function AttendanceWarningBanner({ warning }: { warning: AttendanceWarning }) {
  const critical = warning.level === 'critical'
  const styles = critical
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-amber-50 border-amber-200 text-amber-800'
  return (
    <div className={`rounded-lg border p-3 ${styles}`} role="alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {critical ? 'Attendance warning — please improve' : 'Attendance notice'}
          </p>
          <ul className="text-xs list-disc list-inside space-y-0.5">
            {warning.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="text-xs opacity-90">
            Please be on time and inform your admin in advance if you can&apos;t come.
          </p>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}
