import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../render/Mode7Renderer";
import type { Ship } from "../physics/Ship";

/** How far the ship sprite's bottom edge sits above the screen's bottom edge, in screen pixels. */
export const SHIP_SPRITE_BOTTOM_MARGIN = 26;

function formatTime(seconds: number | null): string {
  if (seconds === null) return "--:--.--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/** Draws the Milestone 1 HUD (speed, lap timer) and the player's own ship sprite. */
export function drawHud(ctx: CanvasRenderingContext2D, ship: Ship, shipSprite: HTMLCanvasElement) {
  ctx.imageSmoothingEnabled = false;

  const spriteScale = 3;
  const spriteW = shipSprite.width * spriteScale;
  const spriteH = shipSprite.height * spriteScale;
  ctx.drawImage(
    shipSprite,
    SCREEN_WIDTH / 2 - spriteW / 2,
    SCREEN_HEIGHT - spriteH - SHIP_SPRITE_BOTTOM_MARGIN,
    spriteW,
    spriteH,
  );

  ctx.font = "8px monospace";
  ctx.textBaseline = "top";

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(2, 2, 78, 28);
  ctx.fillStyle = "#fff";
  ctx.fillText(`LAP ${ship.lapCount}`, 6, 6);
  ctx.fillText(`TIME ${formatTime(ship.currentLapTime)}`, 6, 16);
  ctx.fillText(`BEST ${formatTime(ship.bestLapTime)}`, 6, 26);

  const speedLabel = `${Math.round(ship.speed)}`;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(SCREEN_WIDTH - 62, 2, 60, 12);
  ctx.fillStyle = ship.isOffTrack ? "#ff5050" : "#fff";
  ctx.fillText(`SPD ${speedLabel}`, SCREEN_WIDTH - 58, 5);
}
