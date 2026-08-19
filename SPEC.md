# G-Zero Racer — Game Spec

A retro anti-gravity racer inspired by *F-Zero* (SNES), built from scratch in TypeScript
with a hand-coded Mode 7-style pseudo-3D renderer on HTML5 Canvas.

## 1. Vision

Recreate the feel of F-Zero: blistering top speed, a locked-behind-the-ship camera over a
scaling/rotating textured floor, tight drift-heavy cornering, boost pads, a health bar that
doubles as your damage buffer, and 30-ships-on-a-track chaos (scaled down for scope).

## 2. Tech Stack

- **Language:** TypeScript
- **Rendering:** HTML5 Canvas 2D (`CanvasRenderingContext2D` + raw `ImageData` for the Mode 7
  floor-cast), no WebGL, no game engine, no external rendering libraries.
- **Build tooling:** Vite (dev server + TS bundling only — not part of the "from scratch"
  constraint, which applies to game code, not tooling).
- **Internal resolution:** render to an offscreen low-res canvas (256×224, the SNES
  resolution) and upscale with `image-rendering: pixelated` to whatever the window size is.
  This is what gives it the authentic chunky-pixel look for free.
- **Target:** desktop browsers (Chrome/Firefox/Edge). Keyboard and Gamepad API (`navigator.getGamepads()`)
  are both first-class input methods from Milestone 1 onward — not a later stretch goal.
- **Persistence:** `localStorage` only (best lap times, settings). No backend.

## 3. Core Mechanics (F-Zero-style)

- **Movement:** forward acceleration curve to a top speed, braking, strafing/steering with
  momentum (the ship drifts wide before it turns), a boost that drains a meter and refills
  passively over time.
- **Camera / Track rendering:** Mode 7 floor-cast — for each horizontal scanline below the
  horizon, compute the corresponding row of the track texture from the camera's position,
  height, and yaw, and draw a scaled 1px-tall slice. Distant rows are more compressed
  (further away), near rows fill more of the screen (classic "zooming floor" look).
  Opponents/obstacles are billboard sprites scaled by distance, sorted back-to-front.
  Sky/horizon rendered as a separate static or scrolling gradient band above the floor.
- **Track bounds:** off-track surface slows the ship; a track edge / void causes a fall and
  respawn at the last checkpoint (the classic F-Zero "fell off the track" moment).
- **Health / damage:** ships have an energy bar that depletes on wall hits and opponent
  collisions; it also depletes slowly during boost. Health reaching zero = ship explodes/is
  eliminated. Pit-lane strips on track refill health when driven over.
- **Race structure:** checkpoints → lap counting → N laps → finish. Race position is computed
  from (lap, next checkpoint, distance to it).
- **AI opponents:** 5 AI ships (6-ship grid total, including the player), each following a
  spline of track waypoints, with simple rubber-banding (speed boost when far behind the
  player, slight handicap when far ahead) and basic avoidance of the player/each other.
- **Track data format:** tracks are defined by a small JSON-like schema — an ordered list of
  waypoints (position, width, banking), plus markers for checkpoints, boost pads, and pit
  lanes. The Mode 7 floor texture, collision bounds, and AI waypoint spline are all derived
  from this one format, so a track is authored once and everything downstream stays in sync.
- **Character data format:** each character is one data record — a stat block (top speed,
  acceleration, handling/turn rate, boost power, durability, weight) plus a small set of
  generation params (color palette + shape variant) that procedurally draw its three sprites.
  Stats live in one plain object per character, so tuning a character is editing numbers in
  one place, not touching game logic. The 6-ship grid is filled by assigning each ship
  (player included) one character record.

## 4. Placeholder Art

Per your call, we are **not** sourcing external asset packs — all placeholder visuals are
generated procedurally in code (canvas primitives / `ImageData` patterns), so there's nothing
to download or license, and no dependency on art before the game is playable. This means
there are no external links here; instead, here's exactly what gets generated and where:

| Asset | How it's generated | Used from |
|---|---|---|
| Ship sprite | Small canvas-drawn wedge/triangle shape (~16×16 px) using that character's color palette/shape variant, drawn once to an offscreen canvas and reused as a billboard sprite | Milestone 1 (one character); Milestone 2 (full roster) |
| Track floor texture | Procedural checkerboard (road) bordered by a contrasting stripe pattern (rumble strips), generated onto a tileable `ImageData` at startup | Milestone 1 |
| Sky / horizon | Vertical gradient band, static per track (color set per track "theme") | Milestone 1 |
| Off-track terrain | Second, duller checkerboard/noise pattern outside the track bounds | Milestone 2 |
| Boost pad / pit lane strip | Distinct bright stripe pattern stamped into the floor texture at fixed track positions | Milestone 2 |
| Character select portrait | Larger procedural render of the same character shape/palette (bigger canvas, simple shading), used on the character select grid | Milestone 3 |
| Race position icon | Small (~8×8 px) procedural icon in the character's palette, used in the live position list / results screen | Milestone 3 |
| HUD text | Canvas default monospace font at small pixel sizes (no bitmap font) — good enough as a placeholder; swapping in a real pixel font (e.g. "Press Start 2P") is a trivial later change if you want it | Milestone 1+ |
| Explosion / crash effect | Small procedural particle burst (colored squares expanding + fading) | Milestone 3 |
| UI panels / menu | Flat-colored rects with pixel-style borders (no imagery) | Milestone 3 |

All three character sprites (ship, portrait, position icon) are generated from the *same*
per-character color/shape params in that character's data record, so they stay visually
consistent automatically — no separate art asset to keep in sync per character.

If later you *do* want real pixel-art sprites (nicer ship designs, track skins), that's a
drop-in replacement — the renderer just needs an `HTMLImageElement`/`ImageBitmap` in place of
the generated canvas, no architecture change required.

## 5. Requirements

### Functional
- Keyboard- and gamepad-controlled ship: accelerate, brake, steer left/right, boost.
- Mode 7 floor rendering with correct scale/perspective as camera moves and turns.
- Track boundary detection (on-track / off-track / void).
- Lap counter + checkpoint system + race timer.
- 6-ship grid: player + 5 AI-controlled opponents with waypoint-following behavior.
- Health/damage system with pit-lane refill.
- Race position (1st–6th) computed live.
- HUD: speed, lap/position, health bar, boost meter.
- Title screen → character select → track select → race → results flow.
- Track editor/format that all tracks (including the Milestone 1 oval) are authored through.
- Character roster (6, matching grid size) each with a distinct, easily-editable stat block
  (top speed, acceleration, handling, boost power, durability, weight) and three unique
  sprites (ship, select portrait, position icon).
- At least 2 distinct tracks by the end of Milestone 3.

### Non-functional
- 60 fps on the internal low-res canvas on a mid-range laptop.
- No build step required to *play* a shipped build (Vite production build → static files).
- Code organized so the renderer, physics, input, and game-state are separable modules (not
  a single monolith file) — this matters for iteration speed across 3 milestones, not as
  premature abstraction.

## 6. Milestones (each one is playable)

### Milestone 1 — "It Drives" (core Mode 7 + single-ship control)
- Track data format (JSON-like waypoint schema) designed and in place; the Mode 7 floor
  texture and collision bounds are derived from it, not hand-drawn separately.
- One track authored through that format: a simple oval with rumble-strip edges.
- Character data format (stat block + sprite-generation params) designed and in place; one
  default character built through it for the player to drive.
- Mode 7 renderer working: textured floor scales/rotates correctly as the ship moves/turns.
- Player ship (procedural sprite generated from its character record) with
  acceleration/braking/steering physics driven by that character's stats, tuned to feel fast
  and slightly drifty.
- Keyboard **and** gamepad input both working (accelerate/brake/steer/boost mapped on both).
- Off-track = slowdown; falling past the outer edge = respawn on track.
- Basic HUD: speed readout, lap timer.
- **Playable as:** a free-drive lap-timing sandbox, controllable from keyboard or a gamepad —
  get in the ship, drive laps, see your time. No opponents, no health, no menu yet.

### Milestone 2 — "It's a Race" (full single-player race loop)
- Full roster of 6 characters defined (stats + sprite params), each visually and
  mechanically distinct (different top speed/acceleration/handling/durability/weight).
- 6-ship grid: player + 5 AI opponents, each assigned one of the other characters, following
  the track's waypoint spline, with rubber-band difficulty layered on top of their base stats.
- Health/damage on collisions, pit-lane repair strip, ship elimination at 0 health — a
  character's durability stat sets its max health, weight affects collision knockback.
- Boost meter + boost pads on track.
- Live race position tracking (1st–6th).
- Start countdown (3-2-1-GO) and results screen (finishing order + times) at race end.
- **Playable as:** a complete 6-ship race against AI from start to finish, with a result.

### Milestone 3 — "It's a Game" (content + polish)
- A basic visual track editor (place/drag waypoints, set width/banking, mark checkpoints,
  boost pads, and pit lanes, preview live) built on top of the Milestone 1 track format —
  this is what "more freedom later" cashes out as, and it's what's used to build tracks 2 and 3.
- 2nd and 3rd tracks, authored with the editor, with different layouts/hazards (narrow
  sections, jump ramps).
- Character select screen: grid of the 6 characters showing each one's portrait and stat
  block, confirm to lock in your pick before track select.
- Live position list and results screen switched over to using each ship's position icon
  instead of a plain name/number.
- Title screen, character select, and track-select menus wired into one flow; replay/retry flow.
- Crash/explosion particle effect; basic engine + boost sound (Web Audio, synthesized —
  no audio files, consistent with the "no external assets" approach).
- Best-lap/best-race-time persistence via `localStorage`, shown on track select.
- Difficulty setting (affects AI rubber-banding aggressiveness).
- **Playable as:** the full game loop — boot to menu, pick a track, race a 6-ship grid, see
  results, retry or pick another track.
