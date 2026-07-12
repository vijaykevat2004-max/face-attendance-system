'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFaceModels, useWebcam, detectSingleFace } from '@/lib/face-api'
import { findBestMatch, stringToDescriptor, type FaceDescriptor } from '@/lib/face'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, Loader2, AlertCircle, ScanFace, LogIn, LogOut } from 'lucide-react'

export interface EnrolledEmployee {
  id: string
  employeeId: string
  name: string
  department: string | null
  faceDescriptor: string // serialized
  faceImage: string | null
}

export type ScanAction = 'CHECK_IN' | 'CHECK_OUT' | 'AUTO'

export interface ScanResult {
  employeeId: string
  employeeCode: string
  name: string
  distance: number
  action: 'CHECK_IN' | 'CHECK_OUT'
  response: {
    ok: boolean
    message?: string
    alreadyCheckedIn?: boolean
    alreadyCheckedOut?: boolean
    alreadyCompleted?: boolean
    tooSoonForCheckout?: boolean
    noCheckIn?: boolean
    attendance?: any
  }
}

interface FaceScanProps {
  employees: EnrolledEmployee[]
  action: ScanAction
  onResult: (result: ScanResult | null) => void
  cooldownMs?: number
}

export function FaceScan({ employees, action, onResult, cooldownMs = 4000 }: FaceScanProps) {
  const { state: modelState, error: modelError } = useFaceModels()
  const [active, setActive] = useState(true)
  const { videoRef, error: camError } = useWebcam(active)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<'scanning' | 'matching' | 'matched' | 'no-match' | 'no-face' | 'ambiguous'>('scanning')
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [autoScan, setAutoScan] = useState(true)
  const [faceInFrame, setFaceInFrame] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const employeesRef = useRef(employees)
  // Use a ref so the scan loop can always call the latest attemptMatch without re-subscribing
  const attemptMatchRef = useRef<(q: FaceDescriptor) => Promise<void>>(async () => {})
  // Read latest status inside the interval without re-subscribing the loop
  const statusRef = useRef(status)

  // Keep employeesRef in sync
  useEffect(() => {
    employeesRef.current = employees
  }, [employees])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const attemptMatch = useCallback(
    async (query: FaceDescriptor) => {
      const known = employeesRef.current.map((e) => ({
        id: e.id,
        descriptor: stringToDescriptor(e.faceDescriptor),
      }))
      if (known.length === 0) {
        setStatus('no-match')
        setTimeout(() => setStatus('scanning'), 2000)
        return
      }

      setStatus('matching')
      const match = findBestMatch(query, known)

      if (!match || !match.matched) {
        setStatus(match?.ambiguous ? 'ambiguous' : 'no-match')
        setTimeout(() => setStatus('scanning'), 2500)
        return
      }

      // Found a match — call attendance API
      const emp = employeesRef.current.find((e) => e.id === match.employeeId)
      if (!emp) {
        setStatus('no-match')
        setTimeout(() => setStatus('scanning'), 2000)
        return
      }

      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: emp.id, type: action }),
        })
        const data = await res.json()
        // With action='AUTO' the server decides CHECK_IN vs CHECK_OUT; use its answer for display.
        const actualAction: 'CHECK_IN' | 'CHECK_OUT' =
          data.action ||
          (data.tooSoonForCheckout || data.alreadyCompleted ? 'CHECK_OUT' : action === 'AUTO' ? 'CHECK_IN' : action)
        const result: ScanResult = {
          employeeId: emp.id,
          employeeCode: emp.employeeId,
          name: emp.name,
          distance: match.distance,
          action: actualAction,
          response: data,
        }
        setLastResult(result)
        setStatus('matched')
        onResult(result)
        // Auto-reset after cooldown so the next person can scan
        setTimeout(() => {
          setStatus('scanning')
          setLastResult(null)
        }, cooldownMs)
      } catch (e) {
        console.error('attendance API error', e)
        setStatus('no-match')
        setTimeout(() => setStatus('scanning'), 2000)
      }
    },
    [action, cooldownMs, onResult],
  )

  // Keep ref in sync
  useEffect(() => {
    attemptMatchRef.current = attemptMatch
  }, [attemptMatch])

  // Draw (or clear) the detection box on the overlay canvas
  const drawOverlay = useCallback((result: Awaited<ReturnType<typeof detectSingleFace>>, video: HTMLVideoElement) => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.width = video.videoWidth
    overlay.height = video.videoHeight
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, overlay.width, overlay.height)
    if (result) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 4
      ctx.strokeRect(result.box.x, result.box.y, result.box.width, result.box.height)
      ctx.fillStyle = 'rgba(34,197,94,0.9)'
      ctx.fillRect(result.box.x, Math.max(0, result.box.y - 22), 80, 20)
      ctx.fillStyle = 'white'
      ctx.font = '12px sans-serif'
      ctx.fillText(`Face ${(result.score * 100).toFixed(0)}%`, result.box.x + 4, Math.max(0, result.box.y - 22) + 14)
    }
  }, [])

  // Run one detection+match pass. Shared by the auto-scan loop and the manual button.
  const runScan = useCallback(async () => {
    if (statusRef.current === 'matched' || statusRef.current === 'matching') return
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.readyState < 2) return
    try {
      const result = await detectSingleFace(video)
      drawOverlay(result, video)
      setScanError(null)
      if (result) {
        setFaceInFrame(true)
        await attemptMatchRef.current(result.descriptor)
      } else {
        setFaceInFrame(false)
      }
    } catch (e) {
      // Surface it instead of swallowing — on some in-app/older browsers the
      // WebGL backend used for detection fails, and silent failure looks like
      // "the scanner is frozen".
      console.error('face detection error', e)
      setScanError('Face detection failed on this device. Open the page directly in Chrome or Safari (not inside another app), and make sure the lighting is good.')
    }
  }, [videoRef, drawOverlay])

  // Keep the loop calling the latest runScan without re-subscribing
  const runScanRef = useRef(runScan)
  useEffect(() => {
    runScanRef.current = runScan
  }, [runScan])

  // Continuous auto-scan loop. setInterval (not requestAnimationFrame) because
  // in-app browsers (e.g. opening the link from WhatsApp) throttle rAF hard,
  // which was making the scanner appear dead. A processing guard prevents
  // overlapping detections from piling up on slower phones.
  useEffect(() => {
    if (!autoScan || modelState !== 'ready') return
    let cancelled = false
    let processing = false

    const id = setInterval(async () => {
      if (cancelled || processing) return
      processing = true
      try {
        await runScanRef.current()
      } finally {
        processing = false
      }
    }, 800)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [autoScan, modelState])

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ScanFace className="h-4 w-4 text-emerald-600" />
          <h3 className="font-medium text-sm">
            {action === 'AUTO' ? 'Smart Attendance Scanner' : action === 'CHECK_IN' ? 'Check-In Scanner' : 'Check-Out Scanner'}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {modelState === 'loading' && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading models…
            </span>
          )}
          {modelState === 'ready' && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live scanning
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScan}
              onChange={(e) => setAutoScan(e.target.checked)}
              className="rounded"
            />
            Auto-scan
          </label>
        </div>
      </div>

      {(modelError || camError || scanError) && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{modelError ? 'AI Model Error' : camError ? 'Camera Error' : 'Scanner Error'}</p>
            <p className="text-xs mt-1">{modelError || camError || scanError}</p>
          </div>
        </div>
      )}

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-900">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover -scale-x-100" />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-6 border-2 border-white/30 rounded-lg" />
        {status === 'scanning' && !faceInFrame && modelState === 'ready' && !camError && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="text-white text-xs bg-black/55 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <ScanFace className="h-3.5 w-3.5" /> Position your face in the frame — good lighting helps
            </div>
          </div>
        )}
        {status === 'matching' && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-900/40">
            <div className="text-white flex items-center gap-2 bg-amber-600 px-4 py-2 rounded-full">
              <Loader2 className="h-4 w-4 animate-spin" /> Recognizing…
            </div>
          </div>
        )}
        {status === 'no-match' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/40">
            <div className="text-white text-center bg-red-600 px-4 py-2 rounded-lg">
              <AlertCircle className="h-6 w-6 mx-auto mb-1" />
              <p className="text-sm font-medium">Face not recognized</p>
              <p className="text-xs opacity-90">Please try again or contact admin</p>
            </div>
          </div>
        )}
        {status === 'ambiguous' && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-900/40">
            <div className="text-white text-center bg-amber-600 px-4 py-2 rounded-lg max-w-xs">
              <AlertCircle className="h-6 w-6 mx-auto mb-1" />
              <p className="text-sm font-medium">Too close to call between two employees</p>
              <p className="text-xs opacity-90">Move closer with better lighting, or ask admin to re-enroll your face for a clearer match.</p>
            </div>
          </div>
        )}
        {status === 'matched' && lastResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/50">
            <div className="text-white text-center bg-emerald-600 px-6 py-4 rounded-xl shadow-lg max-w-md">
              <div className="flex items-center justify-center mb-2">
                {action === 'CHECK_IN' ? <LogIn className="h-8 w-8" /> : <LogOut className="h-8 w-8" />}
              </div>
              <p className="text-lg font-bold">{lastResult.name}</p>
              <p className="text-xs opacity-90">{lastResult.employeeCode}</p>
              <p className="text-sm mt-2">{lastResult.response.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-slate-500">Enrolled employees</p>
          <p className="font-semibold text-slate-900">{employees.length}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-slate-500">Match threshold</p>
          <p className="font-semibold text-slate-900">0.5 (Euclidean)</p>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={modelState !== 'ready' || status === 'matching'}
        onClick={() => runScan()}
      >
        <Camera className="h-4 w-4 mr-2" />
        Scan now
      </Button>

      <p className="text-xs text-slate-500">
        Stand in front of the camera. The system scans continuously and automatically recognizes enrolled employees. If it doesn&apos;t pick you up, improve the lighting and tap <span className="font-medium">Scan now</span>. Duplicate check-ins on the same day are blocked.
      </p>
    </Card>
  )
}
