/** One point on a track's centerline spline. */
export interface Waypoint {
  x: number;
  z: number;
  /** Track width at this waypoint, in world units. */
  width: number;
  /** Banking angle in radians (positive = banks right). Unused until later milestones. */
  banking: number;
}

export type ZoneKind = "boost" | "pit";

/** A marker for a special floor zone (boost pad, pit lane) between two waypoint indices. */
export interface TrackZone {
  kind: ZoneKind;
  startIndex: number;
  endIndex: number;
}

export interface TrackDef {
  id: string;
  name: string;
  /** Closed loop of centerline waypoints, in order. */
  waypoints: Waypoint[];
  /** Index of the waypoint pair (i, i+1) that forms the start/finish line. */
  startIndex: number;
  zones: TrackZone[];
  skyColorTop: string;
  skyColorBottom: string;
}

/** Result of projecting a world position onto the track's centerline spline. */
export interface TrackProjection {
  segmentIndex: number;
  /** 0..1 position along the segment. */
  t: number;
  /** Signed distance from centerline; negative = left, positive = right. */
  lateralOffset: number;
  /** Track width at the projected point. */
  trackWidth: number;
  /** Normalized progress around the whole lap, 0..1. */
  lapProgress: number;
  /** Forward tangent direction of the track at the projected point. */
  tangentX: number;
  tangentZ: number;
}
