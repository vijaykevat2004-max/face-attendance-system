// Helpers for face descriptor (de)serialization and matching

export type FaceDescriptor = Float32Array

export function descriptorToString(d: FaceDescriptor): string {
  return JSON.stringify(Array.from(d))
}

export function stringToDescriptor(s: string): FaceDescriptor {
  const arr = JSON.parse(s) as number[]
  return new Float32Array(arr)
}

/**
 * Euclidean distance between two face descriptors.
 * Lower distance = more similar.
 * Typical threshold: 0.5–0.6 (lower = stricter).
 */
export function euclideanDistance(a: FaceDescriptor, b: FaceDescriptor): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export interface MatchResult {
  employeeId: string
  distance: number
  matched: boolean
}

/**
 * Find the best matching employee for a query descriptor.
 * @param query The face descriptor captured from webcam
 * @param known Array of { id, descriptor } of enrolled employees
 * @param threshold Max distance to consider a match (default 0.55)
 */
export function findBestMatch(
  query: FaceDescriptor,
  known: Array<{ id: string; descriptor: FaceDescriptor }>,
  threshold = 0.55,
): MatchResult | null {
  if (known.length === 0) return null
  let best: MatchResult | null = null
  for (const k of known) {
    const dist = euclideanDistance(query, k.descriptor)
    if (!best || dist < best.distance) {
      best = { employeeId: k.id, distance: dist, matched: dist <= threshold }
    }
  }
  return best
}
