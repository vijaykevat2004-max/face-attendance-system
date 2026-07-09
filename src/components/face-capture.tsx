'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useFaceModels, useWebcam, detectSingleFace } from '@/lib/face-api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface FaceCaptureProps {
  onCapture: (descriptor: number[], image: string) => void
  onCancel?: () => void
}

export function FaceCapture({ onCapture, onCancel }: FaceCaptureProps) {
  const { state: modelState, error: modelError } = useFaceModels()
  const [active, setActive] = useState(true)
  const { videoRef, error: camError } = useWebcam(active)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'detecting' | 'captured' | 'no-face'>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null)
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Live preview overlay - draw a guide rectangle
  useEffect(() => {
    if (!active) return
    let raf = 0
    const drawOverlay = () => {
      const video = videoRef.current
      const overlay = overlayRef.current
      if (video && overlay && video.videoWidth) {
        overlay.width = video.videoWidth
        overlay.height = video.videoHeight
        const ctx = overlay.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height)
          // guide circle in center
          ctx.strokeStyle = faceBox ? '#22c55e' : '#94a3b8'
          ctx.lineWidth = 3
          ctx.setLineDash(faceBox ? [] : [8, 6])
          const cx = overlay.width / 2
          const cy = overlay.height / 2
          const r = Math.min(overlay.width, overlay.height) * 0.32
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      raf = requestAnimationFrame(drawOverlay)
    }
    raf = requestAnimationFrame(drawOverlay)
    return () => cancelAnimationFrame(raf)
  }, [active, videoRef, faceBox])

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
      // Draw snapshot to canvas
      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Crop face region with some padding for a nicer thumbnail
      const pad = 0.4
      const bx = Math.max(0, result.box.x - result.box.width * pad)
      const by = Math.max(0, result.box.y - result.box.height * pad)
      const bw = Math.min(canvas.width - bx, result.box.width * (1 + 2 * pad))
      const bh = Math.min(canvas.height - by, result.box.height * (1 + 2 * pad))
      const thumb = document.createElement('canvas')
      thumb.width = 240
      thumb.height = 240
      const tctx = thumb.getContext('2d')
      if (tctx) {
        tctx.drawImage(canvas, bx, by, bw, bh, 0, 0, 240, 240)
      }
      const dataUrl = thumb.toDataURL('image/jpeg', 0.85)
      setCapturedImage(dataUrl)
      setCapturedDescriptor(result.descriptor)
      setFaceBox(result.box)
      setStatus('captured')
    } catch (e) {
      console.error(e)
      setStatus('no-face')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }, [videoRef, modelState])

  const handleConfirm = () => {
    if (!capturedDescriptor || !capturedImage) return
    onCapture(Array.from(capturedDescriptor), capturedImage)
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setCapturedDescriptor(null)
    setFaceBox(null)
    setStatus('idle')
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-emerald-600" />
          <h3 className="font-medium text-sm">Face Enrollment</h3>
        </div>
        {modelState === 'loading' && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading AI models…
          </span>
        )}
        {modelState === 'ready' && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Models ready
          </span>
        )}
      </div>

      {(modelError || camError) && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Camera / Model issue</p>
            <p className="text-xs mt-1">{modelError || camError}</p>
          </div>
        </div>
      )}

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover -scale-x-100"
        />
        <canvas ref={overlayRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {status === 'detecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-white flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Detecting face…
            </div>
          </div>
        )}
        {status === 'no-face' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/50">
            <div className="text-white text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm font-medium">No face detected. Please center your face and try again.</p>
            </div>
          </div>
        )}
        {status === 'captured' && capturedImage && (
          <div className="absolute inset-0">
            <img src={capturedImage} alt="Captured face" className="h-full w-full object-cover" />
            <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1.5">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-2">
        {status !== 'captured' && (
          <Button onClick={handleCapture} disabled={modelState !== 'ready' || status === 'detecting'}>
            <Camera className="h-4 w-4 mr-2" />
            Capture Face
          </Button>
        )}
        {status === 'captured' && (
          <>
            <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Save
            </Button>
            <Button variant="outline" onClick={handleRetake}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retake
            </Button>
          </>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={() => { setActive(false); onCancel() }}>
            Cancel
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Position your face inside the circle. Ensure good lighting and look directly at the camera. The system will compute a 128-dimension face descriptor for recognition.
      </p>
    </Card>
  )
}
