import type { TrackDef } from "./types";
import { WALL_MARGIN, WALL_STRIPE_WIDTH } from "./constants";

export interface BakedTrackTexture {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** World-space (x, z) that maps to pixel (0, 0). */
  originX: number;
  originZ: number;
  pixelsPerUnit: number;
}

const OFF_TRACK_COLOR: [number, number, number] = [20, 40, 24];
const ROAD_COLOR_A: [number, number, number] = [70, 70, 78];
const ROAD_COLOR_B: [number, number, number] = [56, 56, 64];
const RUMBLE_COLOR_A: [number, number, number] = [200, 30, 30];
const RUMBLE_COLOR_B: [number, number, number] = [225, 225, 225];
const WALL_COLOR_A: [number, number, number] = [255, 140, 0];
const WALL_COLOR_B: [number, number, number] = [40, 40, 40];

const CHECKER_TILE = 40;
const RUMBLE_WIDTH = 6;
const RUMBLE_STRIPE_LENGTH = 1; // one stripe color per segment

function roadColorAt(worldX: number, worldZ: number): [number, number, number] {
  const tileX = Math.floor(worldX / CHECKER_TILE);
  const tileZ = Math.floor(worldZ / CHECKER_TILE);
  return (tileX + tileZ) % 2 === 0 ? ROAD_COLOR_A : ROAD_COLOR_B;
}

function setPixel(data: Uint8ClampedArray, width: number, px: number, pz: number, color: [number, number, number]) {
  const idx = (pz * width + px) * 4;
  data[idx] = color[0];
  data[idx + 1] = color[1];
  data[idx + 2] = color[2];
  data[idx + 3] = 255;
}

/** Rasterizes the whole track into one flat top-down bitmap, sampled directly by the Mode 7 renderer. */
export function bakeTrackTexture(track: TrackDef, pixelsPerUnit = 1): BakedTrackTexture {
  const wps = track.waypoints;
  const margin = WALL_MARGIN + 30;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const wp of wps) {
    const half = wp.width / 2 + margin;
    minX = Math.min(minX, wp.x - half);
    maxX = Math.max(maxX, wp.x + half);
    minZ = Math.min(minZ, wp.z - half);
    maxZ = Math.max(maxZ, wp.z + half);
  }

  const width = Math.ceil((maxX - minX) * pixelsPerUnit);
  const height = Math.ceil((maxZ - minZ) * pixelsPerUnit);
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill off-track background first; segments paint the road on top.
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = OFF_TRACK_COLOR[0];
    data[i * 4 + 1] = OFF_TRACK_COLOR[1];
    data[i * 4 + 2] = OFF_TRACK_COLOR[2];
    data[i * 4 + 3] = 255;
  }

  const worldToPixelX = (x: number) => Math.round((x - minX) * pixelsPerUnit);
  const worldToPixelZ = (z: number) => Math.round((z - minZ) * pixelsPerUnit);

  const n = wps.length;
  for (let i = 0; i < n; i++) {
    const p0 = wps[i];
    const p1 = wps[(i + 1) % n];
    const segX = p1.x - p0.x;
    const segZ = p1.z - p0.z;
    const segLen = Math.sqrt(segX * segX + segZ * segZ) || 1;
    const tangentX = segX / segLen;
    const tangentZ = segZ / segLen;
    const normalX = -tangentZ;
    const normalZ = tangentX;
    const maxWidth = Math.max(p0.width, p1.width);

    const half = maxWidth / 2 + WALL_MARGIN + 2;
    const bx0 = Math.min(p0.x, p1.x) - half;
    const bx1 = Math.max(p0.x, p1.x) + half;
    const bz0 = Math.min(p0.z, p1.z) - half;
    const bz1 = Math.max(p0.z, p1.z) + half;

    const px0 = Math.max(0, worldToPixelX(bx0));
    const px1 = Math.min(width - 1, worldToPixelX(bx1));
    const pz0 = Math.max(0, worldToPixelZ(bz0));
    const pz1 = Math.min(height - 1, worldToPixelZ(bz1));

    const stripeColor = Math.floor(i / RUMBLE_STRIPE_LENGTH) % 2 === 0 ? RUMBLE_COLOR_A : RUMBLE_COLOR_B;

    for (let pz = pz0; pz <= pz1; pz++) {
      const worldZ = minZ + pz / pixelsPerUnit;
      for (let px = px0; px <= px1; px++) {
        const worldX = minX + px / pixelsPerUnit;
        const dx = worldX - p0.x;
        const dz = worldZ - p0.z;
        let t = (dx * segX + dz * segZ) / (segLen * segLen);
        if (t < 0 || t > 1) continue;
        const lateral = dx * normalX + dz * normalZ;
        const absLateral = Math.abs(lateral);
        const trackWidth = p0.width + (p1.width - p0.width) * t;
        const half2 = trackWidth / 2;
        const wallBoundary = half2 + WALL_MARGIN;
        if (absLateral > wallBoundary) continue;

        let color: [number, number, number];
        if (absLateral <= half2) {
          color = half2 - absLateral < RUMBLE_WIDTH ? stripeColor : roadColorAt(worldX, worldZ);
        } else if (wallBoundary - absLateral < WALL_STRIPE_WIDTH) {
          color = Math.floor(i / RUMBLE_STRIPE_LENGTH) % 2 === 0 ? WALL_COLOR_A : WALL_COLOR_B;
        } else {
          continue; // plain shoulder — background fill already covers it
        }
        setPixel(data, width, px, pz, color);
      }
    }
  }

  return { data, width, height, originX: minX, originZ: minZ, pixelsPerUnit };
}

/** Nearest-neighbor sample of the baked texture at a world-space position. Returns off-track color if out of bounds. */
export function sampleTrackTexture(tex: BakedTrackTexture, x: number, z: number, out: Uint8ClampedArray, outOffset: number) {
  const px = Math.floor((x - tex.originX) * tex.pixelsPerUnit);
  const pz = Math.floor((z - tex.originZ) * tex.pixelsPerUnit);
  if (px < 0 || px >= tex.width || pz < 0 || pz >= tex.height) {
    out[outOffset] = OFF_TRACK_COLOR[0];
    out[outOffset + 1] = OFF_TRACK_COLOR[1];
    out[outOffset + 2] = OFF_TRACK_COLOR[2];
    return;
  }
  const idx = (pz * tex.width + px) * 4;
  out[outOffset] = tex.data[idx];
  out[outOffset + 1] = tex.data[idx + 1];
  out[outOffset + 2] = tex.data[idx + 2];
}
