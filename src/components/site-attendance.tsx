'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MapPin, RefreshCw, Building2, ExternalLink, Copy, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatTime, getLocalDateString } from '@/lib/salary'

interface SiteRow {
  id: string
  date: string
  checkIn: string | null
  siteLat: number | null
  siteLng: number | null
  sitePhoto: string | null
  employee: {
    id: string
    employeeId: string
    name: string
    department: string | null
  }
}

export function SiteAttendance() {
  const [rows, setRows] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return getLocalDateString(d)
  })
  const [to, setTo] = useState(getLocalDateString())
  const [preview, setPreview] = useState<SiteRow | null>(null)
  const siteCheckinUrl = typeof window !== 'undefined' ? `${window.location.origin}/site-checkin` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(siteCheckinUrl)
    toast.success('Link copied — share it with site employees')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/attendance?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setRows((data.records as any[]).filter((r) => r.source === 'SITE'))
    } catch (e) {
      console.error(e)
      toast.error('Failed to load site attendance')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-600" /> Site Attendance
          </h2>
          <p className="text-sm text-slate-500">Employees who marked present from a work site — with photo & location proof.</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card className="bg-emerald-50 border-emerald-100">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <LinkIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-emerald-900">Share this link with site employees</p>
              <p className="text-xs text-emerald-700 truncate">{siteCheckinUrl}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
          </Button>
        </CardContent>
      </Card>

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} Site Check-In{rows.length === 1 ? '' : 's'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No site check-ins in this range.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setPreview(r)}
                  className="text-left rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition bg-white"
                >
                  {r.sitePhoto ? (
                    <img src={r.sitePhoto} alt={r.employee.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No photo</div>
                  )}
                  <div className="p-2.5">
                    <p className="font-medium text-sm text-slate-900 truncate">{r.employee.name}</p>
                    <p className="text-xs text-slate-500">{r.employee.employeeId} · {formatDate(r.date)}</p>
                    <p className="text-xs text-slate-500">{r.checkIn ? formatTime(r.checkIn) : '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-md">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.employee.name} — {formatDate(preview.date)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {preview.sitePhoto && (
                  <img src={preview.sitePhoto} alt={preview.employee.name} className="w-full rounded-lg object-cover" />
                )}
                <div className="text-sm text-slate-600 space-y-1">
                  <p>{preview.employee.employeeId} · {preview.employee.department || 'No department'}</p>
                  <p>Checked in: {preview.checkIn ? formatTime(preview.checkIn) : '—'}</p>
                </div>
                {preview.siteLat != null && preview.siteLng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${preview.siteLat},${preview.siteLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-700 underline"
                  >
                    <MapPin className="h-3.5 w-3.5" /> View location on map <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
