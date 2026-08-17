'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  TrendingUp, TrendingDown, Minus, Search, Users, Activity,
  ChevronDown, ChevronUp, AlertTriangle, BarChart3, PieChart as PieIcon,
  Clock, Shield, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatPercentage, getZoneBadgeClass, ZONE_CONFIG, ZONE_THRESHOLDS } from '@/lib/attendance-statistics'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface EmployeeRow {
  employeeId: string
  employeeCode: string
  name: string
  department: string | null
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

interface SummaryData {
  totalEmployees: number
  ratedEmployees: number
  notRatedEmployees: number
  greenZoneCount: number
  blueZoneCount: number
  redZoneCount: number
  greenZonePercent: number
  blueZonePercent: number
  redZonePercent: number
  weightedCompanyAttendancePercent: number
  bestPerformingEmployees: EmployeeRow[]
  lowestAttendanceEmployees: EmployeeRow[]
  departmentAverages: Array<{ department: string; averagePercentage: number; employeeCount: number }>
  declinedEmployees: EmployeeRow[]
  totalMissingCheckouts: number
  isProvisional: boolean
  cutoffDate: string
}

interface ApiResponse {
  month: string
  department: string | null
  summary: SummaryData
  employees: EmployeeRow[]
}

function ZoneBadge({ zone }: { zone: EmployeeRow['currentZone'] }) {
  const cfg = ZONE_CONFIG[zone]
  return (
    <Badge className={`${getZoneBadgeClass(zone)} hover:${getZoneBadgeClass(zone)} font-semibold`}>
      {cfg.label}
    </Badge>
  )
}

function TrendIndicator({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-slate-400">—</span>
  if (diff > 0.5) return <span className="text-emerald-600 font-medium flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+{diff.toFixed(1)}%</span>
  if (diff < -0.5) return <span className="text-red-600 font-medium flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />{diff.toFixed(1)}%</span>
  return <span className="text-slate-500">{diff.toFixed(1)}%</span>
}

export function WorkEfficiency() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'attendancePercentage' | 'eligibleWorkingDays' | 'presentDays' | 'absentDays'>('attendancePercentage')
  const [sortAsc, setSortAsc] = useState(false)
  const [zoneFilter, setZoneFilter] = useState<string | null>(null)
  const [expandedBest, setExpandedBest] = useState(false)
  const [expandedLowest, setExpandedLowest] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month })
      if (departmentFilter !== 'ALL') params.set('department', departmentFilter)
      const res = await fetch(`/api/work-efficiency?${params}`)
      if (!res.ok) throw new Error('failed')
      const d: ApiResponse = await res.json()
      setData(d)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load work efficiency data')
    } finally {
      setLoading(false)
    }
  }, [month, departmentFilter])

  useEffect(() => { load() }, [load])

  const departments = useMemo(() => {
    if (!data) return []
    const set = new Set(data.employees.map(e => e.department || 'Unassigned'))
    return Array.from(set).sort()
  }, [data])

  const filteredEmployees = useMemo(() => {
    if (!data) return []
    let list = data.employees
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      )
    }
    if (zoneFilter) {
      list = list.filter(e => e.currentZone === zoneFilter)
    }
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? 0
      const bVal = b[sortKey] ?? 0
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return list
  }, [data, search, zoneFilter, sortKey, sortAsc])

  const pieData = data ? [
    { name: 'Green Zone', value: data.summary.greenZoneCount, color: '#10b981' },
    { name: 'Blue Zone', value: data.summary.blueZoneCount, color: '#3b82f6' },
    { name: 'Red Zone', value: data.summary.redZoneCount, color: '#ef4444' },
  ] : []

  const deptBarData = data?.summary.departmentAverages.map(d => ({
    name: d.department,
    'Avg %': Number(d.averagePercentage.toFixed(1)),
    'Employees': d.employeeCount,
  })) || []

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

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
            <Activity className="h-6 w-6 text-emerald-600" /> Work Efficiency
          </h2>
          <p className="text-sm text-slate-500">
            Attendance analysis and zone classification. No salary deductions applied.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>

      {data?.summary.isProvisional && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>This month is <strong>provisional</strong>. Data is calculated up to {data.summary.cutoffDate}. Final figures will be available after the month ends.</span>
        </div>
      )}

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-emerald-200 bg-emerald-50 cursor-pointer hover:ring-2 hover:ring-emerald-300 transition" onClick={() => setZoneFilter(zoneFilter === 'GREEN' ? null : 'GREEN')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Green Zone</p>
                    <p className="text-3xl font-bold text-emerald-900">{data.summary.greenZoneCount}</p>
                    <p className="text-xs text-emerald-600">{data.summary.greenZonePercent.toFixed(1)}% of workforce</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-200 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-emerald-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50 cursor-pointer hover:ring-2 hover:ring-blue-300 transition" onClick={() => setZoneFilter(zoneFilter === 'BLUE' ? null : 'BLUE')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Blue Zone</p>
                    <p className="text-3xl font-bold text-blue-900">{data.summary.blueZoneCount}</p>
                    <p className="text-xs text-blue-600">{data.summary.blueZonePercent.toFixed(1)}% of workforce</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50 cursor-pointer hover:ring-2 hover:ring-red-300 transition" onClick={() => setZoneFilter(zoneFilter === 'RED' ? null : 'RED')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-red-700 font-medium">Red Zone</p>
                    <p className="text-3xl font-bold text-red-900">{data.summary.redZoneCount}</p>
                    <p className="text-xs text-red-600">{data.summary.redZonePercent.toFixed(1)}% of workforce</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-200 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-red-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-600 font-medium">Company Attendance</p>
                    <p className="text-3xl font-bold text-slate-900">{formatPercentage(data.summary.weightedCompanyAttendancePercent)}</p>
                    <p className="text-xs text-slate-500">{data.summary.totalEmployees} total employees</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Zone Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {data.summary.ratedEmployees === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No rated employees</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Department Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {deptBarData.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="Avg %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Rated employees</span>
                  <span className="font-semibold">{data.summary.ratedEmployees}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Not rated</span>
                  <span className="font-semibold">{data.summary.notRatedEmployees}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Missing checkouts</span>
                  <span className="font-semibold text-amber-600">{data.summary.totalMissingCheckouts}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Declined from prev month</span>
                  <span className="font-semibold text-red-600">{data.summary.declinedEmployees.length}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-slate-600">Salary deductions</span>
                  <Badge className="bg-slate-100 text-slate-600">Disabled</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setExpandedBest(!expandedBest)}>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Best Performing Employees
                  </span>
                  {expandedBest ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              {expandedBest && (
                <CardContent className="pt-0 space-y-2">
                  {data.summary.bestPerformingEmployees.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No data</p>
                  ) : (
                    data.summary.bestPerformingEmployees.map(e => (
                      <div key={e.employeeId} className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-100">
                        <div>
                          <span className="font-medium text-sm">{e.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{e.employeeCode}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ZoneBadge zone={e.currentZone} />
                          <span className="text-sm font-semibold">{formatPercentage(e.attendancePercentage)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setExpandedLowest(!expandedLowest)}>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Lowest Attendance Employees
                  </span>
                  {expandedLowest ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              {expandedLowest && (
                <CardContent className="pt-0 space-y-2">
                  {data.summary.lowestAttendanceEmployees.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No data</p>
                  ) : (
                    data.summary.lowestAttendanceEmployees.map(e => (
                      <div key={e.employeeId} className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-100">
                        <div>
                          <span className="font-medium text-sm">{e.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{e.employeeCode}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ZoneBadge zone={e.currentZone} />
                          <span className="text-sm font-semibold">{formatPercentage(e.attendancePercentage)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Attendance Statistics</CardTitle>
              <CardDescription>
                Showing {filteredEmployees.length} of {data.employees.length} employees
                {zoneFilter && <span className="ml-1">· Filtered: <ZoneBadge zone={zoneFilter as any} /></span>}
                {departmentFilter !== 'ALL' && <span className="ml-1">· Dept: {departmentFilter}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, ID, dept..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('attendancePercentage')}>
                        Employee {sortKey === 'attendancePercentage' && (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)}
                      </TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('eligibleWorkingDays')}>
                        Eligible {sortKey === 'eligibleWorkingDays' && (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)}
                      </TableHead>
                      <TableHead className="text-center">P</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">HD</TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('absentDays')}>
                        Absent {sortKey === 'absentDays' && (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)}
                      </TableHead>
                      <TableHead className="text-center">Earned</TableHead>
                      <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('attendancePercentage')}>
                        % {sortKey === 'attendancePercentage' && (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)}
                      </TableHead>
                      <TableHead className="text-center">Zone</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                      <TableHead className="text-center">Missing Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12 text-slate-500">
                          <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                          No employees match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map(emp => (
                        <TableRow key={emp.employeeId} className="hover:bg-slate-50">
                          <TableCell>
                            <div className="font-medium text-slate-900">{emp.name}</div>
                            <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                          </TableCell>
                          <TableCell className="text-slate-600">{emp.department || '—'}</TableCell>
                          <TableCell className="text-center">{emp.eligibleWorkingDays}</TableCell>
                          <TableCell className="text-center text-emerald-700">{emp.presentDays}</TableCell>
                          <TableCell className="text-center text-amber-700">{emp.lateDays}</TableCell>
                          <TableCell className="text-center text-purple-700">{emp.halfDays}</TableCell>
                          <TableCell className="text-center text-red-700">{emp.absentDays}</TableCell>
                          <TableCell className="text-center font-medium">{emp.earnedAttendanceDays.toFixed(1)}</TableCell>
                          <TableCell className="text-center">
                            {emp.attendancePercentage !== null ? (
                              <span className={`font-bold ${
                                emp.currentZone === 'GREEN' ? 'text-emerald-700' :
                                emp.currentZone === 'BLUE' ? 'text-blue-700' : 'text-red-700'
                              }`}>
                                {formatPercentage(emp.attendancePercentage)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center"><ZoneBadge zone={emp.currentZone} /></TableCell>
                          <TableCell className="text-center"><TrendIndicator diff={emp.trendDifference} /></TableCell>
                          <TableCell className="text-center">
                            {emp.missingCheckoutCount > 0 ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{emp.missingCheckoutCount}</Badge>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-xs text-slate-600 space-y-1">
              <p><strong>Formula:</strong> Earned Days = Present + Late + (Half Days × 0.5). Percentage = Earned Days ÷ Eligible Working Days × 100.</p>
              <p><strong>Zones:</strong> Green ≥ 90% · Blue ≥ 66% &lt; 90% · Red &lt; 66% · Not Rated = 0 eligible days.</p>
              <p><strong>Note:</strong> Sundays, public holidays, leave days, pre-join dates, and post-employment dates are excluded from eligible working days. Future dates are never counted as absent.</p>
              <p className="flex items-center gap-1.5 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Work Efficiency Mode is for attendance analysis only. It does NOT deduct salary, modify payroll, or apply any financial penalty.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}