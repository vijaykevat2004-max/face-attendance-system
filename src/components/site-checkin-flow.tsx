'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SiteFaceCapture } from './site-face-capture'
import {
  MapPin, ScanFace, Loader2, CheckCircle2, AlertCircle, ArrowRight, Building2,
} from 'lucide-react'

interface LookedUpEmployee {
  id: string
  employeeId: string
  name: string
  department: string | null
  faceDescriptor: string
}

type Step = 'code' | 'locate' | 'verify' | 'submitting' | 'success' | 'error'

export function SiteCheckinFlow() {
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [employee, setEmployee] = useState<LookedUpEmployee | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [locError, setLocError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const lookupEmployee = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setLookupLoading(true)
    setLookupError(null)
    try {
      const res = await fetch(`/api/site-checkin/lookup?code=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error || 'Employee code not found')
        return
      }
      setEmployee(data.employee)
      setStep('locate')
    } catch (e) {
      setLookupError('Network error — please try again')
    } finally {
      setLookupLoading(false)
    }
  }

  const getLocation = () => {
    setLocLoading(true)
    setLocError(null)
    if (!navigator.geolocation) {
      setLocError('Location is not supported on this device/browser.')
      setLocLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setLocLoading(false)
        setStep('verify')
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please allow location access and retry.'
            : 'Could not get your location. Please retry.',
        )
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const submit = async (photo: string) => {
    if (!employee || !location) return
    setStep('submitting')
    try {
      const res = await fetch('/api/attendance/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          lat: location.lat,
          lng: location.lng,
          photo,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setResultMessage(data.message)
        setStep('success')
      } else {
        setErrorMessage(data.message || data.error || 'Could not mark attendance')
        setStep('error')
      }
    } catch (e) {
      setErrorMessage('Network error — please try again')
      setStep('error')
    }
  }

  const reset = () => {
    setStep('code')
    setCode('')
    setEmployee(null)
    setLocation(null)
    setLocError(null)
    setLookupError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-sm mx-auto">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Site Attendance</h1>
          <p className="text-sm text-slate-500">Mark yourself present from your work site</p>
        </div>

        {step === 'code' && (
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
                  onKeyDown={(e) => e.key === 'Enter' && lookupEmployee()}
                />
              </div>
              {lookupError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {lookupError}
                </div>
              )}
              <Button onClick={lookupEmployee} disabled={lookupLoading || !code.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {lookupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'locate' && employee && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hi, {employee.name}</CardTitle>
              <CardDescription>{employee.employeeId} · {employee.department || 'No department'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">Next, we need your current location to record where you checked in from.</p>
              {locError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {locError}
                </div>
              )}
              <Button onClick={getLocation} disabled={locLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {locLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                Share My Location
              </Button>
              <Button variant="ghost" onClick={reset} className="w-full">Not you? Start over</Button>
            </CardContent>
          </Card>
        )}

        {step === 'verify' && employee && (
          <SiteFaceCapture targetDescriptor={employee.faceDescriptor} onVerified={submit} />
        )}

        {step === 'submitting' && (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-slate-600">Marking your attendance…</p>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-8 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
              <p className="font-semibold text-emerald-900">{resultMessage}</p>
              {location && (
                <a
                  href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 underline inline-block"
                >
                  View location on map
                </a>
              )}
              <Button variant="outline" onClick={reset} className="w-full mt-2">Done</Button>
            </CardContent>
          </Card>
        )}

        {step === 'error' && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-8 text-center space-y-3">
              <AlertCircle className="h-12 w-12 mx-auto text-amber-600" />
              <p className="font-medium text-amber-900">{errorMessage}</p>
              <Button variant="outline" onClick={reset} className="w-full mt-2">Try Again</Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <ScanFace className="h-3 w-3" /> Face-verified & location-tagged attendance
        </p>
      </div>
    </div>
  )
}
