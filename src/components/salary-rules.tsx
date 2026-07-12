'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings, Plus, Trash2, Save, Clock, AlertCircle, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/salary'

interface Rule {
  id: string
  name: string
  kind: string
  minutesAfter: number | null
  deduction: number
  active: boolean
}

interface ShiftSettings {
  shiftStart: string
  shiftEnd: string
  halfDayAfterMinutes: number
  absentAfterMinutes: number
  standardWorkingHours: number
  minCheckoutGapMinutes: number
  overtimeMultiplier: number
}

export function SalaryRules() {
  const [rules, setRules] = useState<Rule[]>([])
  const [shift, setShift] = useState<ShiftSettings | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New rule form
  const [newRule, setNewRule] = useState({
    name: '',
    kind: 'LATE_TIER',
    minutesAfter: '',
    deduction: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2] = await Promise.all([fetch('/api/rules'), fetch('/api/settings')])
      if (!r1.ok || !r2.ok) throw new Error('failed')
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setRules(d1.rules)
      setShift(d2.shift)
      setCompanyName(d2.companyName || '')
    } catch (e) {
      console.error(e)
      toast.error('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = async () => {
    if (!shift) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift, companyName }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success('Settings saved')
    } catch (e) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateRule = async (id: string, patch: Partial<Rule>) => {
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('failed')
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    } catch (e) {
      toast.error('Failed to update rule')
      load()
    }
  }

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return
    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('failed')
      setRules((prev) => prev.filter((r) => r.id !== id))
      toast.success('Rule deleted')
    } catch (e) {
      toast.error('Failed to delete rule')
    }
  }

  const addRule = async () => {
    if (!newRule.name || !newRule.deduction) {
      toast.error('Name and deduction are required')
      return
    }
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          kind: newRule.kind,
          minutesAfter: newRule.minutesAfter === '' ? null : Number(newRule.minutesAfter),
          deduction: Number(newRule.deduction),
          active: true,
        }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setRules((prev) => [...prev, data.rule])
      setNewRule({ name: '', kind: 'LATE_TIER', minutesAfter: '', deduction: '' })
      toast.success('Rule added')
    } catch (e) {
      toast.error('Failed to add rule')
    }
  }

  if (loading || !shift) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const lateTiers = rules.filter((r) => r.kind === 'LATE_TIER').sort((a, b) => (a.minutesAfter ?? 0) - (b.minutesAfter ?? 0))
  const otherRules = rules.filter((r) => r.kind !== 'LATE_TIER')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" /> Salary & Attendance Rules
        </h2>
        <p className="text-sm text-slate-500">Configure company shift timing and customize late-arrival deduction tiers.</p>
      </div>

      {/* Shift settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" /> Shift & Company Settings
          </CardTitle>
          <CardDescription>Define work hours and absence thresholds. Daily wage = base salary ÷ working days in month.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company Name</Label>
            <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start">Shift Start</Label>
            <Input id="start" type="time" value={shift.shiftStart} onChange={(e) => setShift({ ...shift, shiftStart: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Shift End</Label>
            <Input id="end" type="time" value={shift.shiftEnd} onChange={(e) => setShift({ ...shift, shiftEnd: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="halfDay">Half-Day After (minutes late)</Label>
            <Input
              id="halfDay"
              type="number"
              value={shift.halfDayAfterMinutes}
              onChange={(e) => setShift({ ...shift, halfDayAfterMinutes: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Half-day salary deducted past this lateness.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="absent">Absent After (minutes late)</Label>
            <Input
              id="absent"
              type="number"
              value={shift.absentAfterMinutes}
              onChange={(e) => setShift({ ...shift, absentAfterMinutes: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Full-day salary deducted past this lateness.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hours">Standard Working Hours</Label>
            <Input
              id="hours"
              type="number"
              step="0.5"
              value={shift.standardWorkingHours}
              onChange={(e) => setShift({ ...shift, standardWorkingHours: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minGap">Min. Gap Before Check-Out (minutes)</Label>
            <Input
              id="minGap"
              type="number"
              value={shift.minCheckoutGapMinutes}
              onChange={(e) => setShift({ ...shift, minCheckoutGapMinutes: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Prevents accidental checkout if the scanner sees the same face again right after check-in.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="otMultiplier">Overtime Pay Multiplier</Label>
            <Input
              id="otMultiplier"
              type="number"
              step="0.1"
              min="0"
              value={shift.overtimeMultiplier}
              onChange={(e) => setShift({ ...shift, overtimeMultiplier: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">Extra pay rate for hours worked beyond standard hours (1.5 = time-and-a-half). Set to 0 to disable overtime pay.</p>
          </div>
          <div className="md:col-span-3">
            <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-2" /> Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Late arrival tiers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Late Arrival Deduction Tiers</CardTitle>
          <CardDescription>
            When an employee arrives N minutes after shift start, the highest matching tier applies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lateTiers.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">No late tiers configured.</div>
          ) : (
            <div className="space-y-2">
              {lateTiers.map((r) => (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2">
                  <div className="col-span-4">
                    <Input
                      value={r.name}
                      onChange={(e) => updateRule(r.id, { name: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <Input
                      type="number"
                      value={r.minutesAfter ?? 0}
                      onChange={(e) => updateRule(r.id, { minutesAfter: Number(e.target.value) })}
                      className="text-sm"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">min late</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="text-xs text-slate-500">₹</span>
                    <Input
                      type="number"
                      value={r.deduction}
                      onChange={(e) => updateRule(r.id, { deduction: Number(e.target.value) })}
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => updateRule(r.id, { active: v })}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)} className="text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new tier */}
          <div className="border-2 border-dashed border-slate-200 rounded-md p-3 grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4">
              <Input
                placeholder="Tier name (e.g. Late after 15 min)"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="col-span-3 flex items-center gap-1">
              <Input
                type="number"
                placeholder="15"
                value={newRule.minutesAfter}
                onChange={(e) => setNewRule({ ...newRule, minutesAfter: e.target.value })}
                className="text-sm"
              />
              <span className="text-xs text-slate-500">min</span>
            </div>
            <div className="col-span-3 flex items-center gap-1">
              <span className="text-xs text-slate-500">₹</span>
              <Input
                type="number"
                placeholder="100"
                value={newRule.deduction}
                onChange={(e) => setNewRule({ ...newRule, deduction: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <Button size="sm" onClick={addRule} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info card with example */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-medium">How deductions are calculated</p>
            <p>For each day, the system picks the highest matching tier where <code className="bg-white px-1 rounded">minutesAfter ≤ actualLateMinutes</code>, then applies that tier&apos;s deduction.</p>
            <p>If the employee arrives past <strong>{shift.halfDayAfterMinutes} min late</strong>, half-day salary is deducted (overrides tier). Past <strong>{shift.absentAfterMinutes} min late</strong> or no check-in, full-day salary is deducted.</p>
            <p>Daily wage = <code className="bg-white px-1 rounded">baseSalary ÷ workingDaysInMonth</code> (excludes Sundays).</p>
            <p>Hours worked past <strong>{shift.standardWorkingHours}h</strong> on a completed day are paid as overtime at <code className="bg-white px-1 rounded">hourlyRate × {shift.overtimeMultiplier}</code>, added on top of salary.</p>
          </div>
        </CardContent>
      </Card>

      {/* Other rules */}
      {otherRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" /> Other Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.kind} · Deduction {formatCurrency(r.deduction)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.active} onCheckedChange={(v) => updateRule(r.id, { active: v })} />
                  <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)} className="text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
