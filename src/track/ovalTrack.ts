import type { TrackDef, Waypoint } from "./types";

/**
 * Builds a "stadium" oval: two straights joined by two semicircular end caps,
 * traced counter-clockwise starting at the bottom of the +x straight.
 */
function buildOvalWaypoints(): Waypoint[] {
  const width = 200;
  const radius = 260;
  const straightHalfLength = 350;
  const straightSegments = 20;
  const capSegments = 24;
  const points: Waypoint[] = [];

  const push = (x: number, z: number) => points.push({ x, z, width, banking: 0 });

  // Straight A: (radius, -straightHalfLength) -> (radius, +straightHalfLength)
  for (let i = 0; i < straightSegments; i++) {
    const t = i / straightSegments;
    push(radius, -straightHalfLength + straightHalfLength * 2 * t);
  }

  // Top cap: semicircle centered at (0, straightHalfLength), sweeping angle 0 -> PI.
  for (let i = 0; i < capSegments; i++) {
    const angle = (Math.PI * i) / capSegments;
    push(Math.cos(angle) * radius, straightHalfLength + Math.sin(angle) * radius);
  }

  // Straight B: (-radius, +straightHalfLength) -> (-radius, -straightHalfLength)
  for (let i = 0; i < straightSegments; i++) {
    const t = i / straightSegments;
    push(-radius, straightHalfLength - straightHalfLength * 2 * t);
  }

  // Bottom cap: semicircle centered at (0, -straightHalfLength), sweeping angle PI -> 2*PI.
  for (let i = 0; i < capSegments; i++) {
    const angle = Math.PI + (Math.PI * i) / capSegments;
    push(Math.cos(angle) * radius, -straightHalfLength + Math.sin(angle) * radius);
  }

  return points;
}

export const OVAL_TRACK: TrackDef = {
  id: "oval",
  name: "Oval Circuit",
  waypoints: buildOvalWaypoints(),
  startIndex: 0,
  zones: [],
  skyColorTop: "#0a0033",
  skyColorBottom: "#ff6a3d",
};
