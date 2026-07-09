'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFaceModels, useWebcam, detectSingleFace } from '@/lib/face-api'
import { euclideanDistance, stringToDescriptor } from '@/lib/face'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, CheckCircle2, Loader2, AlertCircle, RefreshCw, XCircle } from 'lucide-react'

interface SiteFaceCaptureProps {
  targetDescriptor: string // serialized descriptor of the employee to verify against
  threshold?: number
  onVerified: (image: string) => void
}

export function SiteFaceCapture({ targetDescriptor, threshold = 0.55, onVerified }: SiteFaceCaptureProps) {
  const { state: modelState, error: modelError } = useFaceModels()
  const [active] = useState(true)
  const { videoRef, error: camError } = useWebcam(active)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'detecting' | 'matched' | 'no-match' | 'no-face'>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || modelState !== 'ready') return
    setStatus('detecting')
    try {
      const result = await detectSingleFace(video)
      if (!result) {
        setStatus('no-face')
        setTimeout(() => setStatus('idle'), 2000)
        return
      }

      const dist = euclideanDistance(result.descriptor, stringToDescriptor(targetDescriptor))
      if (dist > threshold) {
        setStatus('no-match')
        setTimeout(() => setStatus('idle'), 2500)
        return
      }

      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedImage(dataUrl)
      setStatus('matched')
    } catch (e) {
      console.error(e)
      setStatus('no-face')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }, [videoRef, modelState, targetDescriptor, threshold])

  const handleConfirm = () => {
    if (!capturedImage) return
    onVerified(capturedImage)
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setStatus('idle')
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-600" />
          <h3 className="font-medium text-sm">Verify Your Face</h3>
        </div>
        {modelState === 'loading' && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </span>
        )}
      </div>

      {(modelError || camError) && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-xs">{modelError || camError}</p>
        </div>
      )}

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-900">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover -scale-x-100" />
        {status === 'detecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-white flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
            </div>
          </div>
        )}
        {status === 'no-face' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
            <div className="text-white text-center px-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-medium">No face detected. Center your face and retry.</p>
            </div>
          </div>
        )}
        {status === 'no-match' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
            <div className="text-white text-center px-4">
              <XCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-medium">Face doesn't match this employee code. Try again.</p>
            </div>
          </div>
        )}
        {status === 'matched' && capturedImage && (
          <div className="absolute inset-0">
            <img src={capturedImage} alt="Verified face" className="h-full w-full object-cover" />
            <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1.5">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-2">
        {status !== 'matched' && (
          <Button onClick={handleCapture} disabled={modelState !== 'ready' || status === 'detecting'} className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Scan My Face
          </Button>
        )}
        {status === 'matched' && (
          <>
            <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm
            </Button>
            <Button variant="outline" onClick={handleRetake}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retake
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
