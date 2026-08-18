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

const OFF_TRACK_R = 20, OFF_TRACK_G = 40, OFF_TRACK_B = 24;
const FOG_NEAR = 900;
const FOG_FAR = 3200;

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

  renderFloor(camera: Camera, texture: BakedTrackTexture) {
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

      const fog = 1 - Math.max(0, Math.min(1, (distance - FOG_NEAR) / (FOG_FAR - FOG_NEAR))) * 0.55;
      const rowOffset = row * SCREEN_WIDTH;

      for (let x = 0; x < SCREEN_WIDTH; x++) {
        const px = (worldX - originX) * ppu | 0;
        const pz = (worldZ - originZ) * ppu | 0;
        let r: number, g: number, b: number;
        if (px < 0 || px >= texW || pz < 0 || pz >= texH) {
          r = OFF_TRACK_R;
          g = OFF_TRACK_G;
          b = OFF_TRACK_B;
        } else {
          const idx = (pz * texW + px) * 4;
          r = texData[idx];
          g = texData[idx + 1];
          b = texData[idx + 2];
        }
        this.floorPixels32[rowOffset + x] =
          (255 << 24) | ((b * fog) << 16) | ((g * fog) << 8) | (r * fog);
        worldX += stepX;
        worldZ += stepZ;
      }
    }

    this.ctx.putImageData(this.floorImage, 0, HORIZON_Y);
  }
}
