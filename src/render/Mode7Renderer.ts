import type { BakedTrackTexture } from "../track/trackTexture";

// 16:9 internal resolution that scales by an exact integer factor (5x) to 1920x1080.
export const SCREEN_WIDTH = 384;
export const SCREEN_HEIGHT = 216;
export const HORIZON_Y = 85;

export interface Camera {
  x: number;
  z: number;
  /** Radians. Forward direction = (sin(yaw), cos(yaw)). */
  yaw: number;
  height: number;
}

const OFF_TRACK_R = 8, OFF_TRACK_G = 4, OFF_TRACK_B = 22;
const FOG_NEAR = 900;
const FOG_FAR = 3200;
// Void areas fade into the sky's horizon color over a longer distance than the general fog —
// this is what sells the far-off terrain as hazy and distant rather than a crisp flat floor.
const VOID_FADE_NEAR = 500;
const VOID_FADE_FAR = 2600;

// A second, lower ground layer rendered wherever the track texture is void, using its own
// floor-cast offset further below the camera than the track — this is what reads as distant
// terrain underneath a floating track, rather than the track hovering over pure empty space.
const TERRAIN_DEPTH_OFFSET = 420;
const TERRAIN_TILE = 150;
const TERRAIN_COLOR_A = { r: 42, g: 36, b: 48 };
const TERRAIN_COLOR_B = { r: 32, g: 27, b: 37 };

function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Hand-rolled Mode 7 floor-cast: renders the track texture as a scaling/rotating ground
 * plane by projecting one row of world space per screen scanline below the horizon.
 */
export class Mode7Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private floorImage: ImageData;
  private floorPixels32: Uint32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    const floorRows = SCREEN_HEIGHT - HORIZON_Y;
    this.floorImage = ctx.createImageData(SCREEN_WIDTH, floorRows);
    this.floorPixels32 = new Uint32Array(this.floorImage.data.buffer);
  }

  renderSky(topColor: string, bottomColor: string) {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, HORIZON_Y);
  }

  renderFloor(camera: Camera, texture: BakedTrackTexture, horizonColorHex: string) {
    const focalLength = SCREEN_WIDTH / 2;
    const cosYaw = Math.cos(camera.yaw);
    const sinYaw = Math.sin(camera.yaw);
    const floorRows = SCREEN_HEIGHT - HORIZON_Y;
    const texData = texture.data;
    const texW = texture.width;
    const texH = texture.height;
    const originX = texture.originX;
    const originZ = texture.originZ;
    const ppu = texture.pixelsPerUnit;
    const [horizonR, horizonG, horizonB] = parseHexColor(horizonColorHex);

    const terrainCamHeight = camera.height + TERRAIN_DEPTH_OFFSET;

    for (let row = 0; row < floorRows; row++) {
      const rowFromHorizon = row + 1;
      const distance = (camera.height * focalLength) / rowFromHorizon;
      const halfWidth = distance; // simplified ~90deg horizontal FOV (focalLength == SCREEN_WIDTH / 2)

      const centerX = camera.x + sinYaw * distance;
      const centerZ = camera.z + cosYaw * distance;
      let worldX = centerX - cosYaw * halfWidth;
      let worldZ = centerZ + sinYaw * halfWidth;
      const stepX = (cosYaw * halfWidth * 2) / SCREEN_WIDTH;
      const stepZ = (-sinYaw * halfWidth * 2) / SCREEN_WIDTH;

      // Terrain layer: the same ray angles, but projected as if the ground were
      // TERRAIN_DEPTH_OFFSET units further below the camera than the track — this is what
      // makes it read as a lower surface visible underneath the track, not the same floor.
      const terrainDistance = (terrainCamHeight * focalLength) / rowFromHorizon;
      const terrainHalfWidth = terrainDistance;
      const terrainCenterX = camera.x + sinYaw * terrainDistance;
      const terrainCenterZ = camera.z + cosYaw * terrainDistance;
      let terrainWorldX = terrainCenterX - cosYaw * terrainHalfWidth;
      let terrainWorldZ = terrainCenterZ + sinYaw * terrainHalfWidth;
      const terrainStepX = (cosYaw * terrainHalfWidth * 2) / SCREEN_WIDTH;
      const terrainStepZ = (-sinYaw * terrainHalfWidth * 2) / SCREEN_WIDTH;

      const fog = 1 - Math.max(0, Math.min(1, (distance - FOG_NEAR) / (FOG_FAR - FOG_NEAR))) * 0.55;
      const voidBlend = Math.max(0, Math.min(1, (distance - VOID_FADE_NEAR) / (VOID_FADE_FAR - VOID_FADE_NEAR)));
      // As void pixels approach full blend into the sky color, their fog dimming fades out
      // too, so the horizon line matches the sky exactly instead of showing a seam.
      const voidFog = fog + (1 - fog) * voidBlend;
      const rowOffset = row * SCREEN_WIDTH;

      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const px = (worldX - originX) * ppu | 0;
        const pz = (worldZ - originZ) * ppu | 0;
        let r: number, g: number, b: number;
        let isVoid: boolean;
        if (px < 0 || px >= texW || pz < 0 || pz >= texH) {
          r = OFF_TRACK_R;
          g = OFF_TRACK_G;
          b = OFF_TRACK_B;
          isVoid = true;
        } else {
          const idx = (pz * texW + px) * 4;
          r = texData[idx];
          g = texData[idx + 1];
          b = texData[idx + 2];
          isVoid = r === OFF_TRACK_R && g === OFF_TRACK_G && b === OFF_TRACK_B;
        }
        // The track is a floating ribbon, not solid ground — anywhere off the track shows the
        // terrain layer below instead, fading into the sky's horizon color with distance.
        if (isVoid) {
          const tileX = Math.floor(terrainWorldX / TERRAIN_TILE);
          const tileZ = Math.floor(terrainWorldZ / TERRAIN_TILE);
          const terrainColor = (tileX + tileZ) % 2 === 0 ? TERRAIN_COLOR_A : TERRAIN_COLOR_B;
          r = terrainColor.r;
          g = terrainColor.g;
          b = terrainColor.b;
          if (voidBlend > 0) {
            r = r + (horizonR - r) * voidBlend;
            g = g + (horizonG - g) * voidBlend;
            b = b + (horizonB - b) * voidBlend;
          }
        }
        const pixelFog = isVoid ? voidFog : fog;
        this.floorPixels32[rowOffset + x] =
          (255 << 24) | ((b * pixelFog) << 16) | ((g * pixelFog) << 8) | (r * pixelFog);
        worldX += stepX;
        worldZ += stepZ;
        terrainWorldX += terrainStepX;
        terrainWorldZ += terrainStepZ;
      }
    }

    this.ctx.putImageData(this.floorImage, 0, HORIZON_Y);
  }
}
