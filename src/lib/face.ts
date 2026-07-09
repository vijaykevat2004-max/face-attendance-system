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
  /** True when the best match was rejected because a second enrolled face was nearly as close — too risky to guess between them. */
  ambiguous: boolean
}

// Minimum gap required between the best and second-best candidate before we'll
// trust the match. Without this, two employees whose enrolled faces happen to
// sit close together in descriptor space (similar lighting/angle at signup,
// or just similar features) can get silently swapped for each other — one
// person's scan ends up marking a *different* employee present.
const MIN_MATCH_MARGIN = 0.08

/**
 * Find the best matching employee for a query descriptor.
 * @param query The face descriptor captured from webcam
 * @param known Array of { id, descriptor } of enrolled employees
 * @param threshold Max distance to consider a match (default 0.5)
 */
export function findBestMatch(
  query: FaceDescriptor,
  known: Array<{ id: string; descriptor: FaceDescriptor }>,
  threshold = 0.5,
): MatchResult | null {
  if (known.length === 0) return null

  const distances = known
    .map((k) => ({ employeeId: k.id, distance: euclideanDistance(query, k.descriptor) }))
    .sort((a, b) => a.distance - b.distance)

  const best = distances[0]
  const runnerUp = distances[1]
  const ambiguous = !!runnerUp && runnerUp.distance - best.distance < MIN_MATCH_MARGIN

  return {
    employeeId: best.employeeId,
    distance: best.distance,
    matched: best.distance <= threshold && !ambiguous,
    ambiguous,
  }
}
