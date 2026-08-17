'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar, Loader2, TrendingUp, TrendingDown, Minus,
  Building2, User, Award, AlertCircle, CheckCircle2, XCircle,
  LogOut, ChevronLeft, ChevronRight, Menu
} from 'lucide-react'
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

export default function EmployeeDashboardPage() {
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
        toast.error(result.error || 'Failed to load dashboard')
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

  const handleLogout = async () => {
    try {
      await fetch('/api/employee-auth/logout', { method: 'POST' })
      router.push('/employee/login')
    } catch {
      toast.error('Logout failed')
    }
  }

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'dd MMM')
  }

  const getDayOfWeek = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), 'EEE')
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      PRESENT: { label: 'Present', className: 'bg-emerald-100 text-emerald-700' },
      LATE: { label: 'Late', className: 'bg-amber-100 text-amber-700' },
      HALF_DAY: { label: 'Half Day', className: 'bg-purple-100 text-purple-700' },
      ABSENT: { label: 'Absent', className: 'bg-red-100 text-red-700' },
      LEAVE: { label: 'Leave', className: 'bg-blue-100 text-blue-700' },
      SUNDAY: { label: 'Sunday', className: 'bg-slate-100 text-slate-600' },
      HOLIDAY: { label: 'Holiday', className: 'bg-slate-100 text-slate-600' },
      BEFORE_JOIN: { label: 'Before Join', className: 'bg-slate-100 text-slate-500' },
      AFTER_END: { label: 'After End', className: 'bg-slate-100 text-slate-500' },
      FUTURE: { label: 'Future', className: 'bg-slate-100 text-slate-400' },
    }
    return config[status] || { label: status, className: 'bg-slate-100 text-slate-600' }
  }

  const getZoneBadge = (zone: string) => {
    const config: Record<string, { label: string; className: string }> = {
      GREEN: { label: 'GREEN - Excellent', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      BLUE: { label: 'BLUE - Acceptable', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      RED: { label: 'RED - Poor', className: 'bg-red-100 text-red-700 border-red-200' },
      NOT_RATED: { label: 'Not Rated', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    }
    return config[zone] || config.NOT_RATED
  }

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '—'
    return format(new Date(isoStr), 'hh:mm a')
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

  const { employee, month, stats, messages, attendanceHistory, zoneConfig } = data
  const zoneBadge = getZoneBadge(stats.currentZone)
  const attendancePercent = stats.attendancePercentage !== null ? stats.attendancePercentage.toFixed(1) : '—'
  const prevPercent = stats.previousMonthPercentage !== null ? stats.previousMonthPercentage.toFixed(1) : '—'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-emerald-600" />
            <span className="font-semibold text-lg">Employee Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 hidden sm:block">{employee.employeeId}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Month Selector */}
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
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

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-20">
        {/* Employee Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-lg truncate">{employee.name}</h2>
                <p className="text-sm text-slate-500">{employee.employeeId}</p>
                {employee.department && (
                  <p className="text-xs text-slate-400">{employee.department}</p>
                )}
              </div>
              <Badge className={zoneBadge.className} style={{ fontSize: '11px' }}>
                {zoneBadge.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Percentage - Large Display */}
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-sm text-slate-500 uppercase tracking-wide mb-1">Attendance</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold text-slate-900">{attendancePercent}</span>
              <span className="text-2xl text-slate-500 self-end mb-1">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {stats.earnedAttendanceDays.toFixed(1)} / {stats.eligibleWorkingDays} eligible days
            </p>
            {month.isProvisional && (
              <Badge variant="secondary" className="mt-2 mx-auto w-fit">
                Provisional - Month in progress
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Automatic Messages */}
        {messages.length > 0 && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-4 pb-4">
              <div className="space-y-2">
                {messages.map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Present" value={stats.presentDays} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
          <StatCard label="Late" value={stats.lateDays} icon={<AlertCircle className="h-5 w-5 text-amber-600" />} />
          <StatCard label="Half Day" value={stats.halfDays} icon={<Award className="h-5 w-5 text-purple-600" />} />
          <StatCard label="Absent" value={stats.absentDays} icon={<XCircle className="h-5 w-5 text-red-600" />} />
          <StatCard label="Leave" value={stats.leaveDays} icon={<Building2 className="h-5 w-5 text-blue-600" />} />
          <StatCard label="Eligible Days" value={stats.eligibleWorkingDays} icon={<Calendar className="h-5 w-5 text-slate-600" />} />
        </div>

        {/* Previous Month Comparison */}
        {stats.previousMonthPercentage !== null && (
          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium text-slate-900">Previous Month Comparison</h3>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{prevPercent}%</p>
                  <p className="text-xs text-slate-500">Last month attendance</p>
                </div>
                <div className="text-right">
                  {stats.trendDifference !== null && (
                    <>
                      <p className={`text-xl font-bold ${stats.trendDifference > 0 ? 'text-emerald-600' : stats.trendDifference < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        {stats.trendDifference > 0 ? '+' : ''}{stats.trendDifference.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-500">
                        {stats.trendDifference > 0.5 ? (
                          <>
                            <TrendingUp className="h-3 w-3 inline mr-1" /> Improved
                          </>
                        ) : stats.trendDifference < -0.5 ? (
                          <>
                            <TrendingDown className="h-3 w-3 inline mr-1" /> Declined
                          </>
                        ) : (
                          <>
                            <Minus className="h-3 w-3 inline mr-1" /> Stable
                          </>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Missing Checkout Warning */}
        {stats.missingCheckoutCount > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Missing Checkout Records</p>
                  <p className="text-sm text-amber-700 mt-1">
                    You have {stats.missingCheckoutCount} {stats.missingCheckoutCount === 1 ? 'record' : 'records'} with missing checkout.
                    Please contact your administrator to resolve this.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link href="/employee/attendance" className="block">
            <Card className="h-full text-center py-4 hover:bg-slate-50 transition-colors">
              <CardContent>
                <Calendar className="h-7 w-7 mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-medium text-slate-900">Attendance History</p>
                <p className="text-xs text-slate-500">View daily records</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/employee/change-pin" className="block">
            <Card className="h-full text-center py-4 hover:bg-slate-50 transition-colors">
              <CardContent>
                <Award className="h-7 w-7 mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-medium text-slate-900">Change PIN</p>
                <p className="text-xs text-slate-500">Update your PIN</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <div className="flex justify-center mb-2">{icon}</div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </CardContent>
    </Card>
  )
}