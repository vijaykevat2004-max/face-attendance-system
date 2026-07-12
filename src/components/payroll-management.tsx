'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Wallet, Sparkles, CheckCircle2, Download, Landmark, AlertTriangle, Trash2, Loader2, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate, getISTParts } from '@/lib/salary'

interface RunSummary {
  id: string
  month: string
  status: 'DRAFT' | 'APPROVED' | 'PAID'
  totalAmount: number
  employeeCount: number
  generatedAt: string
  approvedAt: string | null
  approvedBy: string | null
  paidAt: string | null
  paidBy: string | null
}

interface LineItem {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  baseSalary: number
  presentDays: number
  lateDays: number
  halfDays: number
  absentDays: number
  totalDeduction: number
  totalOvertimePay: number
  netPayable: number
  bankAccountNumber: string | null
  bankIFSC: string | null
  bankAccountHolder: string | null
}

interface RunDetail extends RunSummary {
  items: LineItem[]
}

function maskAccount(acc: string | null): string {
  if (!acc) return '—'
  if (acc.length <= 4) return acc
  return `••••${acc.slice(-4)}`
}

function defaultMonth(): string {
  const { year, month } = getISTParts()
  return `${year}-${String(month).padStart(2, '0')}`
}

export function PayrollManagement() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(defaultMonth())
  const [generating, setGenerating] = useState(false)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payroll')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setRuns(data.runs)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load payroll runs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/payroll/${id}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to load run')
        return
      }
      setDetail(data.run)
    } catch (e) {
      toast.error('Network error')
    } finally {
      setDetailLoading(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate payroll')
        return
      }
      toast.success(`Payroll draft generated for ${month}`)
      await loadRuns()
      setDetail(data.run)
    } catch (e) {
      toast.error('Network error')
    } finally {
      setGenerating(false)
    }
  }

  const approve = async () => {
    if (!detail) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/payroll/${detail.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to approve')
        return
      }
      toast.success('Payroll approved — payout file is now available')
      await loadRuns()
      await openDetail(detail.id)
    } catch (e) {
      toast.error('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const markPaid = async () => {
    if (!detail) return
    if (!confirm(`Confirm you have already transferred ${formatCurrency(detail.totalAmount)} via your bank? This locks the run as PAID.`)) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/payroll/${detail.id}/mark-paid`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to mark as paid')
        return
      }
      toast.success('Payroll run marked as paid')
      await loadRuns()
      await openDetail(detail.id)
    } catch (e) {
      toast.error('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const deleteRun = async () => {
    if (!detail) return
    if (!confirm(`Delete this draft payroll run for ${detail.month}? This cannot be undone.`)) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/payroll/${detail.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }
      toast.success('Draft deleted')
      setDetail(null)
      await loadRuns()
    } catch (e) {
      toast.error('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const missingBankCount = detail ? detail.items.filter((i) => !i.bankAccountNumber || !i.bankIFSC).length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" /> Payroll
          </h2>
          <p className="text-sm text-slate-500">Auto-calculate monthly salary, review it, then download a bank payout file. Nothing here moves money automatically.</p>
        </div>
        <Button variant="outline" onClick={loadRuns}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" /> A draft for the previous month is generated automatically on the 1st of every month — you don't need to click "Generate" yourself unless you want to refresh a draft early.
      </p>

      <Card className="bg-emerald-50 border-emerald-100">
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="month" className="text-xs">Month</Label>
            <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
          <Button onClick={generate} disabled={generating} className="bg-emerald-600 hover:bg-emerald-700">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Payroll Draft
          </Button>
          <p className="text-xs text-emerald-700">Regenerating a still-draft month recalculates it from the latest attendance data.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No payroll runs yet. Generate one above.</div>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className="w-full text-left rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="font-medium text-slate-900">{r.month}</div>
                    <div className="text-xs text-slate-500">{r.employeeCount} employees · Generated {formatDate(r.generatedAt)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{formatCurrency(r.totalAmount)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail || detailLoading} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailLoading && !detail ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" /></div>
          ) : detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Payroll — {detail.month} <StatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  {detail.employeeCount} employees · Total {formatCurrency(detail.totalAmount)}
                  {detail.approvedAt && ` · Approved by ${detail.approvedBy} on ${formatDate(detail.approvedAt)}`}
                  {detail.paidAt && ` · Paid by ${detail.paidBy} on ${formatDate(detail.paidAt)}`}
                </DialogDescription>
              </DialogHeader>

              {missingBankCount > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{missingBankCount} employee(s) missing bank details — they'll be excluded from the payout file. Add their bank details in Employee Management, then regenerate this draft (if still DRAFT).</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2 pr-3 font-medium">Employee</th>
                      <th className="py-2 pr-3 font-medium">Present/Late/Half/Absent</th>
                      <th className="py-2 pr-3 font-medium">Base</th>
                      <th className="py-2 pr-3 font-medium">Deduction</th>
                      <th className="py-2 pr-3 font-medium">Overtime</th>
                      <th className="py-2 pr-3 font-medium">Net Payable</th>
                      <th className="py-2 font-medium">Bank A/C</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-slate-900">{item.employeeName}</div>
                          <div className="text-xs text-slate-500">{item.employeeCode}</div>
                        </td>
                        <td className="py-2 pr-3 text-slate-600 text-xs">
                          {item.presentDays}/{item.lateDays}/{item.halfDays}/{item.absentDays}
                        </td>
                        <td className="py-2 pr-3">{formatCurrency(item.baseSalary)}</td>
                        <td className="py-2 pr-3 text-red-600">{item.totalDeduction > 0 ? `-${formatCurrency(item.totalDeduction)}` : '—'}</td>
                        <td className="py-2 pr-3 text-teal-600">{item.totalOvertimePay > 0 ? `+${formatCurrency(item.totalOvertimePay)}` : '—'}</td>
                        <td className="py-2 pr-3 font-semibold">{formatCurrency(item.netPayable)}</td>
                        <td className="py-2">
                          {item.bankAccountNumber ? (
                            <span className="text-xs text-slate-600 flex items-center gap-1">
                              <Landmark className="h-3 w-3" /> {maskAccount(item.bankAccountNumber)}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600">Missing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {detail.status === 'DRAFT' && (
                  <>
                    <Button onClick={approve} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                      {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                    <Button variant="outline" onClick={deleteRun} disabled={actionLoading} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Draft
                    </Button>
                  </>
                )}
                {(detail.status === 'APPROVED' || detail.status === 'PAID') && (
                  <Button asChild variant="outline">
                    <a href={`/api/payroll/${detail.id}/payout-file`} download>
                      <Download className="h-4 w-4 mr-2" /> Download Payout File (CSV)
                    </a>
                  </Button>
                )}
                {detail.status === 'APPROVED' && (
                  <Button onClick={markPaid} disabled={actionLoading} className="bg-purple-600 hover:bg-purple-700">
                    {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Mark as Paid
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Downloading the payout file does not transfer any money. Upload it to your bank's corporate portal and confirm the transfer there, then come back and mark this run as paid.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700',
  }
  return <Badge className={`${map[status] || 'bg-slate-100 text-slate-700'} hover:${map[status] || 'bg-slate-100'}`}>{status}</Badge>
}
