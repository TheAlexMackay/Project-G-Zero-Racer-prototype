import "./style.css";
import { DEFAULT_CHARACTER } from "./character/defaultCharacter";
import { generateShipSprite } from "./character/spriteGen";
import { drawHud, SHIP_SPRITE_BOTTOM_MARGIN } from "./hud/Hud";
import { InputManager } from "./input/InputManager";
import { Ship } from "./physics/Ship";
import { HORIZON_Y, Mode7Renderer, SCREEN_HEIGHT, SCREEN_WIDTH } from "./render/Mode7Renderer";
import { OVAL_TRACK } from "./track/ovalTrack";
import { bakeTrackTexture } from "./track/trackTexture";

const CAMERA_HEIGHT = 70;
const MAX_DT = 0.05;

// The ship's collision point should line up with where its sprite actually touches down on
// screen, not an arbitrary offset — so derive how far behind the ship the camera sits from
// the same Mode 7 distance formula the floor renderer uses, evaluated at the sprite's own
// screen row (its bottom edge, where the hull meets the track).
const shipSpriteBottomRow = SCREEN_HEIGHT - SHIP_SPRITE_BOTTOM_MARGIN - HORIZON_Y;
const CAMERA_BACK_OFFSET = (CAMERA_HEIGHT * (SCREEN_WIDTH / 2)) / (shipSpriteBottomRow + 1);

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const renderer = new Mode7Renderer(canvas);
const input = new InputManager();
const track = OVAL_TRACK;
const trackTexture = bakeTrackTexture(track);
const ship = new Ship(DEFAULT_CHARACTER, track);
const shipSprite = generateShipSprite(DEFAULT_CHARACTER);

function resizeCanvas() {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_WIDTH, window.innerHeight / SCREEN_HEIGHT)));
  canvas.style.width = `${SCREEN_WIDTH * scale}px`;
  canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let lastTime = performance.now();

function frame(now: number) {
  const dt = Math.min(MAX_DT, (now - lastTime) / 1000);
  lastTime = now;

  input.update();
  ship.update(dt, input.state, track);

  const camera = {
    x: ship.x - Math.sin(ship.velAngle) * CAMERA_BACK_OFFSET,
    z: ship.z - Math.cos(ship.velAngle) * CAMERA_BACK_OFFSET,
    yaw: ship.heading,
    height: CAMERA_HEIGHT,
  };

  renderer.renderSky(track.skyColorTop, track.skyColorBottom);
  renderer.renderFloor(camera, trackTexture, track.skyColorBottom);
  drawHud(renderer.ctx, ship, shipSprite);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
