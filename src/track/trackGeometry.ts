import type { TrackDef, TrackProjection } from "./types";

/** Projects a world-space (x, z) position onto the closest point on the track's centerline. */
export function projectToTrack(track: TrackDef, x: number, z: number): TrackProjection {
  const wps = track.waypoints;
  const n = wps.length;
  let best: TrackProjection | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < n; i++) {
    const p0 = wps[i];
    const p1 = wps[(i + 1) % n];
    const segX = p1.x - p0.x;
    const segZ = p1.z - p0.z;
    const segLenSq = segX * segX + segZ * segZ;

    const dx = x - p0.x;
    const dz = z - p0.z;
    let t = segLenSq > 0 ? (dx * segX + dz * segZ) / segLenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const closestX = p0.x + segX * t;
    const closestZ = p0.z + segZ * t;
    const distSq = (x - closestX) ** 2 + (z - closestZ) ** 2;

    if (distSq < bestDistSq) {
      const segLen = Math.sqrt(segLenSq) || 1;
      const tangentX = segX / segLen;
      const tangentZ = segZ / segLen;
      // Right-hand normal of the forward tangent (points to driver's right).
      const normalX = -tangentZ;
      const normalZ = tangentX;
      // Vector from the closest point on the segment to (x, z), dotted with the normal.
      const toPointX = x - closestX;
      const toPointZ = z - closestZ;
      const signedLateral = toPointX * normalX + toPointZ * normalZ;

      bestDistSq = distSq;
      best = {
        segmentIndex: i,
        t,
        lateralOffset: signedLateral,
        trackWidth: p0.width + (p1.width - p0.width) * t,
        lapProgress: (i + t) / n,
        tangentX,
        tangentZ,
      };
    }
  }

  return best!;
}

/** World-space position at a given lap progress (0..1), for spawning/respawning ships. */
export function pointAtProgress(track: TrackDef, progress: number): { x: number; z: number; tangentX: number; tangentZ: number } {
  const wps = track.waypoints;
  const n = wps.length;
  const p = ((progress % 1) + 1) % 1;
  const scaled = p * n;
  const i = Math.floor(scaled) % n;
  const t = scaled - Math.floor(scaled);
  const p0 = wps[i];
  const p1 = wps[(i + 1) % n];
  const segX = p1.x - p0.x;
  const segZ = p1.z - p0.z;
  const segLen = Math.sqrt(segX * segX + segZ * segZ) || 1;
  return {
    x: p0.x + segX * t,
    z: p0.z + segZ * t,
    tangentX: segX / segLen,
    tangentZ: segZ / segLen,
  };
}
