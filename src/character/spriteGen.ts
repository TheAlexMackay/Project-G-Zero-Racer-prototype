import type { CharacterDef } from "./types";

const SIZE = 16;

/**
 * Procedurally draws a small top-down wedge-shaped ship sprite from a character's color
 * palette. This is the placeholder art strategy for Milestone 1 — no external image assets.
 */
export function generateShipSprite(character: CharacterDef): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const { primary, secondary, accent } = character.colors;

  const body: [number, number][] = [
    [8, 0],
    [13, 9],
    [16, 15],
    [8, 11],
    [0, 15],
    [3, 9],
  ];

  const tracePath = () => {
    ctx.beginPath();
    body.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  };

  ctx.fillStyle = primary;
  tracePath();
  ctx.fill();

  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(11, 8);
  ctx.lineTo(8, 9);
  ctx.lineTo(5, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.fillRect(7, 9, 2, 6);

  ctx.strokeStyle = "#0a0a12";
  ctx.lineWidth = 1;
  tracePath();
  ctx.stroke();

  return canvas;
}
