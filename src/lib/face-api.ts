'use client'

import * as faceapi from '@vladmandic/face-api'
import { useEffect, useState, useRef } from 'react'

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null

async function ensureModels(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoading) return modelsLoading

  modelsLoading = (async () => {
    const MODEL_URL = '/models'
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    modelsLoaded = true
  })()

  return modelsLoading
}

export interface FaceDetectionResult {
  descriptor: Float32Array
  score: number
  box: { x: number; y: number; width: number; height: number }
}

/**
 * Hook to load face-api models. Returns loading/error state.
 */
export function useFaceModels() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ensureModels()
      .then(() => {
        if (mounted) setState('ready')
      })
      .catch((e) => {
        console.error('Failed to load face models', e)
        if (mounted) {
          setState('error')
          setError(e?.message || 'Failed to load models')
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  return { state, error }
}

/**
 * Detect a single face from a video frame or image and return its 128-d descriptor.
 * Returns null if no face is found.
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<FaceDetectionResult | null> {
  await ensureModels()

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  })

  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!result) return null

  return {
    descriptor: result.descriptor,
    score: result.detection.score,
    box: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
  }
}

/**
 * Hook that exposes a ref to a <video> element and continuously reads frames
 * from the user's webcam. Returns the active stream so the caller can stop it.
 */
export function useWebcam(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let localStream: MediaStream | null = null

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not supported in this browser')
        }
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop())
          return
        }
        setStream(localStream)
        if (videoRef.current) {
          videoRef.current.srcObject = localStream
          await videoRef.current.play().catch(() => {})
        }
      } catch (e: any) {
        console.error('webcam error', e)
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser.'
            : e?.name === 'NotFoundError'
              ? 'No camera found. Please connect a webcam.'
              : e?.message || 'Failed to start camera',
        )
      }
    }

    start()

    return () => {
      cancelled = true
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop())
      }
      setStream(null)
    }
  }, [active])

  return { videoRef, stream, error }
}
