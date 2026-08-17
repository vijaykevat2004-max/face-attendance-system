'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Calendar, Plus, Trash2, Loader2, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/salary'

interface Holiday {
  id: string
  date: string
  name: string
  active: boolean
  createdAt: string
}

interface HolidayForm {
  date: string
  name: string
  active: boolean
}

const EMPTY_FORM: HolidayForm = { date: '', name: '', active: true }

export function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<HolidayForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/holidays')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setHolidays(data.holidays)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (h: Holiday) => {
    setEditingId(h.id)
    setForm({
      date: h.date.split('T')[0],
      name: h.name,
      active: h.active,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const submit = async () => {
    if (!form.date || !form.name) {
      toast.error('Date and name are required')
      return
    }
    setSaving(true)
    try {
      const payload = { date: form.date, name: form.name, active: form.active }
      const url = editingId ? `/api/holidays/${editingId}` : '/api/holidays'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save')
        return
      }
      toast.success(editingId ? 'Holiday updated' : 'Holiday added')
      setEditingId(null)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Network error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (h: Holiday) => {
    try {
      const res = await fetch(`/api/holidays/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !h.active }),
      })
      if (!res.ok) throw new Error('failed')
      setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x)))
      toast.success(h.active ? 'Holiday deactivated' : 'Holiday activated')
    } catch {
      toast.error('Failed to toggle holiday')
    }
  }

  const remove = async (h: Holiday) => {
    if (!confirm(`Delete holiday "${h.name}"?`)) return
    try {
      const res = await fetch(`/api/holidays/${h.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      toast.success('Holiday deleted')
      load()
    } catch {
      toast.error('Failed to delete holiday')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6 text-emerald-600" /> Holiday Management
        </h2>
        <p className="text-sm text-slate-500">Manage company holidays. Active holidays are excluded from attendance eligibility calculations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit Holiday' : 'Add Holiday'}</CardTitle>
          <CardDescription>{editingId ? 'Update the holiday details.' : 'Add a new public holiday to the calendar.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hDate">Date</Label>
              <Input
                id="hDate"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hName">Holiday Name</Label>
              <Input
                id="hName"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Republic Day"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingId ? 'Update' : 'Add Holiday'}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No holidays configured. Add one above.</div>
          ) : (
            <div className="space-y-2">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={h.active} onCheckedChange={() => toggleActive(h)} />
                    <div>
                      <div className="font-medium text-sm">{h.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(h.date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={h.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'}>
                      {h.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(h)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
