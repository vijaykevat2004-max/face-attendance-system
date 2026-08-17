'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Loader2, ChevronLeft, ChevronRight, ArrowLeft, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface EmployeePortalStats {
  employee: { id: string; employeeId: string; name: string; department: string | null }
  month: { year: number; month: number; isProvisional: boolean; cutoffDate: string }
  stats: {
    eligibleWorkingDays: number
    presentDays: number
    lateDays: number
    halfDays: number
    absentDays: number
    leaveDays: number
    earnedAttendanceDays: number
    attendancePercentage: number | null
    currentZone: 'GREEN' | 'BLUE' | 'RED' | 'NOT_RATED'
    missingCheckoutCount: number
    previousMonthPercentage: number | null
    previousMonthZone: 'GREEN' | 'BLUE' | 'RED' | 'NOT_RATED'
    trendDifference: number | null
    isProvisional: boolean
  }
  messages: string[]
  attendanceHistory: Array<{
    date: string
    status: string
    checkIn: string | null
    checkOut: string | null
    workingHours: number
    lateMinutes: number
    hasMissingCheckout: boolean
    source: string
    isHoliday: boolean
    isSunday: boolean
    isBeforeJoin: boolean
    isAfterEnd: boolean
    isFuture: boolean
  }>
  zoneConfig: Record<string, { zone: string; label: string; color: string }>
}

export default function EmployeeAttendancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EmployeePortalStats | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employee-portal/stats?month=${selectedMonth}`)
      if (res.status === 401) {
        router.push('/employee/login')
        return
      }
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Failed to load attendance')
        return
      }
      setData(result)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [selectedMonth])

  const handleMonthChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month - 1 + delta, 1)
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
  }

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; className: string; dotColor: string }> = {
      PRESENT: { label: 'Present', className: 'bg-emerald-100 text-emerald-700', dotColor: 'bg-emerald-500' },
      LATE: { label: 'Late', className: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-500' },
      HALF_DAY: { label: 'Half Day', className: 'bg-purple-100 text-purple-700', dotColor: 'bg-purple-500' },
      ABSENT: { label: 'Absent', className: 'bg-red-100 text-red-700', dotColor: 'bg-red-500' },
      LEAVE: { label: 'Leave', className: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500' },
      SUNDAY: { label: 'Sunday', className: 'bg-slate-100 text-slate-600', dotColor: 'bg-slate-400' },
      HOLIDAY: { label: 'Holiday', className: 'bg-slate-100 text-slate-600', dotColor: 'bg-slate-400' },
      BEFORE_JOIN: { label: 'Before Join', className: 'bg-slate-100 text-slate-500', dotColor: 'bg-slate-300' },
      AFTER_END: { label: 'After End', className: 'bg-slate-100 text-slate-500', dotColor: 'bg-slate-300' },
      FUTURE: { label: 'Future', className: 'bg-slate-100 text-slate-400', dotColor: 'bg-slate-300' },
    }
    return config[status] || config.ABSENT
  }

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '—'
    return format(new Date(isoStr), 'hh:mm a')
  }

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'dd MMM')
  }

  const getDayOfWeek = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'EEE')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  const { employee, month, attendanceHistory } = data

  // Filter out future dates for display
  const displayHistory = attendanceHistory.filter(h => !h.isFuture)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/employee/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
            <div>
              <p className="font-semibold text-sm">Employee Portal</p>
              <p className="text-xs text-slate-500">{employee.name} • {employee.employeeId}</p>
            </div>
          </Link>
        </div>

        {/* Month Selector */}
        <div className="px-4 py-3 border-t border-slate-100 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => handleMonthChange(-1)} disabled={loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-sm font-medium text-slate-900">
                {format(new Date(month.year, month.month - 1, 1), 'MMMM yyyy')}
              </p>
              {month.isProvisional && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Provisional
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => handleMonthChange(1)} disabled={loading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-20">
        {/* Legend */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Status Legend</p>
            <div className="flex flex-wrap gap-2">
              <LegendItem color="bg-emerald-500" label="Present" />
              <LegendItem color="bg-amber-500" label="Late" />
              <LegendItem color="bg-purple-500" label="Half Day" />
              <LegendItem color="bg-red-500" label="Absent" />
              <LegendItem color="bg-blue-500" label="Leave" />
              <LegendItem color="bg-slate-400" label="Holiday/Sunday" />
            </div>
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-7 gap-1 mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before 1st */}
              {Array.from({ length: new Date(month.year, month.month - 1, 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {displayHistory.map((day) => {
                const config = getStatusConfig(day.status)
                const dayNum = new Date(day.date + 'T00:00:00').getDate()
                const isToday = day.date === format(new Date(), 'yyyy-MM-dd')

                return (
                  <div
                    key={day.date}
                    className={`relative aspect-square rounded-lg p-1.5 transition-colors ${
                      isToday ? 'ring-2 ring-emerald-500' : ''
                    } ${day.status === 'SUNDAY' || day.status === 'HOLIDAY' ? 'bg-slate-50' : ''}`}
                  >
                    <div className="text-xs font-medium text-slate-600">{dayNum}</div>
                    <div className={`w-full h-full rounded ${config.className} flex items-center justify-center`}>
                      <span className="text-[10px] font-medium">{config.label}</span>
                    </div>
                    {(day.checkIn || day.checkOut) && (
                      <div className="absolute bottom-1 left-1 right-1 text-[9px] text-slate-600">
                        {day.checkIn && `In: ${formatTime(day.checkIn)}`}
                        {day.checkIn && day.checkOut && ' • '}
                        {day.checkOut && `Out: ${formatTime(day.checkOut)}`}
                        {day.workingHours > 0 && ` (${day.workingHours}h)`}
                      </div>
                    )}
                    {day.hasMissingCheckout && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" title="Missing checkout" />
                    )}
                    {day.lateMinutes > 0 && day.status === 'LATE' && (
                      <div className="absolute top-1 left-1 w-2 h-2 bg-amber-500 rounded" title={`${day.lateMinutes} min late`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed List View */}
        <Card>
          <CardHeader className="pb-2">
            <h3 className="font-medium text-slate-900">Daily Details</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayHistory
                .filter(d => d.status !== 'FUTURE' && d.status !== 'BEFORE_JOIN' && d.status !== 'AFTER_END')
                .map((day) => {
                  const config = getStatusConfig(day.status)
                  return (
                    <div
                      key={day.date}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                        <div>
                          <p className="font-medium text-sm">{formatDate(day.date)} ({getDayOfWeek(day.date)})</p>
                          <p className="text-xs text-slate-500">{config.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        {day.checkIn && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> In: {formatTime(day.checkIn)}
                          </span>
                        )}
                        {day.checkOut && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Out: {formatTime(day.checkOut)}
                          </span>
                        )}
                        {day.workingHours > 0 && (
                          <span className="text-emerald-600 font-medium">{day.workingHours}h</span>
                        )}
                        {day.lateMinutes > 0 && (
                          <Badge variant="secondary" className="text-xs">+{day.lateMinutes}min</Badge>
                        )}
                        {day.hasMissingCheckout && (
                          <Badge variant="destructive" className="text-xs">Missing Out</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}