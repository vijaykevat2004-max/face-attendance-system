'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  LogIn, LogOut, RefreshCw, Clock, Users, CheckCircle2, AlertCircle, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { FaceScan, type EnrolledEmployee, type ScanResult } from './face-scan'
import { formatTime, formatCurrency, IST_TIME_ZONE } from '@/lib/salary'

interface TodayRow {
  employee: {
    id: string
    employeeId: string
    name: string
    department: string | null
    position: string | null
    faceImage: string | null
  }
  attendance: {
    id: string
    checkIn: string | null
    checkOut: string | null
    status: string
    lateMinutes: number
    workingHours: number
    deduction: number
    note: string | null
  } | null
}

export function LiveAttendance() {
  const [employees, setEmployees] = useState<EnrolledEmployee[]>([])
  const [todayRows, setTodayRows] = useState<TodayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastResults, setLastResults] = useState<ScanResult[]>([])

  const loadEmployees = useCallback(async () => {
    try {
      // Single fetch — include descriptors so the scanner can match
      const res = await fetch('/api/employees?all=0&withDescriptor=1')
      if (!res.ok) return
      const data = await res.json()
      setEmployees(
        (data.employees as any[]).map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          name: e.name,
          department: e.department,
          faceDescriptor: e.faceDescriptor,
          faceImage: e.faceImage,
        })),
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadToday = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/today')
      if (!res.ok) return
      const data = await res.json()
      setTodayRows(data.rows)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadEmployees(), loadToday()])
  }, [loadEmployees, loadToday])

  const onResult = (result: ScanResult | null) => {
    if (!result) return
    setLastResults((prev) => [result, ...prev].slice(0, 20))
    if (result.response.ok) {
      toast.success(result.response.message || `${result.name} — ${result.action}`)
    } else {
      toast.warning(result.response.message || `${result.name} — already processed`)
    }
    // Refresh today's log
    loadToday()
  }

  const presentCount = todayRows.filter((r) => r.attendance?.checkIn).length
  const checkedOutCount = todayRows.filter((r) => r.attendance?.checkOut).length
  const activeEmployees = todayRows.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Attendance Kiosk</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: IST_TIME_ZONE })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadEmployees(); loadToday() }}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 font-medium">Enrolled</p>
              <p className="text-2xl font-bold text-emerald-900">{employees.length}</p>
            </div>
            <Users className="h-7 w-7 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Checked In Today</p>
              <p className="text-2xl font-bold text-blue-900">{presentCount}</p>
            </div>
            <LogIn className="h-7 w-7 text-blue-600" />
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-700 font-medium">Checked Out</p>
              <p className="text-2xl font-bold text-purple-900">{checkedOutCount}</p>
            </div>
            <LogOut className="h-7 w-7 text-purple-600" />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-700 font-medium">Still Working</p>
              <p className="text-2xl font-bold text-slate-900">{Math.max(0, presentCount - checkedOutCount)}</p>
            </div>
            <Clock className="h-7 w-7 text-slate-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Scanner */}
        <div className="lg:col-span-3 space-y-4">
          {employees.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                <p className="font-medium text-slate-700">No enrolled employees</p>
                <p className="text-sm text-slate-500 mt-1">Please enroll employees with their face data first.</p>
              </CardContent>
            </Card>
          ) : (
            <FaceScan
              employees={employees}
              action="AUTO"
              onResult={onResult}
              cooldownMs={5000}
            />
          )}
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-80 overflow-y-auto">
              {lastResults.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-6">
                  Scan results will appear here.
                </div>
              ) : (
                lastResults.map((r, i) => (
                  <div
                    key={`${r.employeeId}-${i}`}
                    className={`rounded-md border p-2 text-xs ${
                      r.response.ok
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{r.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {r.action === 'CHECK_IN' ? 'IN' : 'OUT'}
                      </Badge>
                    </div>
                    <p className="text-slate-600 mt-0.5">
                      {r.response.message || 'Processed'}
                    </p>
                    <p className="text-slate-400 mt-0.5">
                      Match: {(1 - r.distance).toFixed(2)} confidence
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Today's full list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Attendance Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-2 md:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : todayRows.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">No active employees.</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {todayRows
                .slice()
                .sort((a, b) => {
                  // Sort: checked-in first, then by check-in time, absent last
                  const aIn = a.attendance?.checkIn ? 1 : 0
                  const bIn = b.attendance?.checkIn ? 1 : 0
                  if (aIn !== bIn) return bIn - aIn
                  return (a.attendance?.checkIn || '').localeCompare(b.attendance?.checkIn || '')
                })
                .map((row) => (
                  <div
                    key={row.employee.id}
                    className={`rounded-lg border p-3 flex items-center gap-3 ${
                      row.attendance?.checkOut
                        ? 'bg-purple-50 border-purple-100'
                        : row.attendance?.checkIn
                          ? 'bg-emerald-50 border-emerald-100'
                          : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      {row.employee.faceImage && <AvatarImage src={row.employee.faceImage} />}
                      <AvatarFallback>{row.employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 truncate">{row.employee.name}</div>
                      <div className="text-xs text-slate-500">
                        {row.employee.employeeId} · {row.employee.department || '—'}
                      </div>
                      {row.attendance?.checkIn ? (
                        <div className="text-xs text-slate-600 mt-0.5">
                          In: {formatTime(row.attendance.checkIn)}
                          {row.attendance.checkOut && ` · Out: ${formatTime(row.attendance.checkOut)}`}
                          {row.attendance.lateMinutes > 0 && (
                            <span className="text-amber-600 ml-1">(+{row.attendance.lateMinutes}m)</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-0.5">Not checked in</div>
                      )}
                    </div>
                    {row.attendance?.deduction ? (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        -{formatCurrency(row.attendance.deduction)}
                      </Badge>
                    ) : row.attendance?.checkOut ? (
                      <Badge variant="outline" className="text-purple-600 border-purple-200">
                        {row.attendance.workingHours.toFixed(1)}h
                      </Badge>
                    ) : row.attendance?.checkIn ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">Working</Badge>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
