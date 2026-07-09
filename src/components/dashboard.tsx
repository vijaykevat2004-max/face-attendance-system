'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, UserX, Clock, LogOut, TrendingUp, Calendar } from 'lucide-react'
import { formatTime, formatCurrency, IST_TIME_ZONE } from '@/lib/salary'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Stats {
  date: string
  totals: {
    totalEmployees: number
    activeEmployees: number
    presentToday: number
    lateToday: number
    absentToday: number
    checkedOutToday: number
  }
  trend: Array<{ date: string; present: number; late: number; absent: number }>
  deptBreakdown: Record<string, number>
  todayRecords: Array<{
    id: string
    employee: { id: string; employeeId: string; name: string; department: string | null }
    checkIn: string | null
    checkOut: string | null
    status: string
    lateMinutes: number
    workingHours: number
    deduction: number
    note: string | null
  }>
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setStats(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000) // refresh every 30s
    return () => clearInterval(id)
  }, [])

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const trendData = stats.trend.map((t) => ({
    date: t.date.slice(5),
    Present: t.present,
    Late: t.late,
    Absent: t.absent,
  }))

  const deptData = Object.entries(stats.deptBreakdown).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(stats.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: IST_TIME_ZONE })}
          </p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Live • auto-refresh 30s
        </Badge>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Active Employees"
          value={stats.totals.activeEmployees}
          subtitle={`${stats.totals.totalEmployees} total enrolled`}
          icon={<Users className="h-5 w-5" />}
          color="emerald"
        />
        <KpiCard
          title="Present Today"
          value={stats.totals.presentToday}
          subtitle={`${((stats.totals.presentToday / Math.max(1, stats.totals.activeEmployees)) * 100).toFixed(0)}% attendance`}
          icon={<UserCheck className="h-5 w-5" />}
          color="blue"
        />
        <KpiCard
          title="Late Arrivals"
          value={stats.totals.lateToday}
          subtitle={`${formatCurrency(stats.todayRecords.filter(r => r.status === 'LATE').reduce((s, r) => s + r.deduction, 0))} deductions`}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <KpiCard
          title="Absent Today"
          value={stats.totals.absentToday}
          subtitle="No check-in recorded"
          icon={<UserX className="h-5 w-5" />}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              7-Day Attendance Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Absent" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-8">
                No check-ins yet today.
              </div>
            ) : (
              <div className="space-y-3">
                {deptData.map((d, i) => {
                  const max = Math.max(...deptData.map((x) => x.value))
                  return (
                    <div key={d.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{d.name}</span>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(d.value / max) * 100}%`,
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][i % 5],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's attendance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="h-4 w-4 text-slate-500" />
            Today&apos;s Attendance Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.todayRecords.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8">
              No attendance recorded today yet. Use the Live Attendance kiosk to start checking in.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">Dept</th>
                    <th className="py-2 pr-4 font-medium">Check In</th>
                    <th className="py-2 pr-4 font-medium">Check Out</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Late</th>
                    <th className="py-2 pr-4 font-medium">Hours</th>
                    <th className="py-2 font-medium text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.todayRecords
                    .slice()
                    .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''))
                    .map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-2 pr-4">
                          <div className="font-medium text-slate-900">{r.employee.name}</div>
                          <div className="text-xs text-slate-500">{r.employee.employeeId}</div>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{r.employee.department || '—'}</td>
                        <td className="py-2 pr-4">{r.checkIn ? formatTime(r.checkIn) : '—'}</td>
                        <td className="py-2 pr-4">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                        <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
                        <td className="py-2 pr-4 text-slate-600">{r.lateMinutes > 0 ? `${r.lateMinutes}m` : '—'}</td>
                        <td className="py-2 pr-4 text-slate-600">{r.workingHours > 0 ? r.workingHours.toFixed(2) : '—'}</td>
                        <td className="py-2 text-right font-medium text-slate-900">
                          {r.deduction > 0 ? formatCurrency(r.deduction) : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  title, value, subtitle, icon, color,
}: {
  title: string
  value: number | string
  subtitle: string
  icon: React.ReactNode
  color: 'emerald' | 'blue' | 'amber' | 'red'
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }
  return (
    <Card className={`border ${colors[color]}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs opacity-70 mt-1">{subtitle}</p>
          </div>
          <div className="rounded-lg bg-white/60 p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
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
