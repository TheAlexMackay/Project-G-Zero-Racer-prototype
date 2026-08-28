import type { CharacterDef } from "../character/types";
import type { InputState } from "../input/InputManager";
import { WALL_MARGIN } from "../track/constants";
import type { TrackDef } from "../track/types";
import { pointAtProgress, projectToTrack } from "../track/trackGeometry";

const OFF_TRACK_DRAG = 0.6; // speed multiplier per second while off-track
const GRIP_BASE = 6; // how fast velocity direction catches up to heading (radians/sec at low speed)
const WALL_RESTITUTION = 0.65; // fraction of into-wall speed reflected back out on impact
const STUN_IMPACT_SPEED = 400; // minimum into-wall speed that stuns the ship on bounce
const STUN_DURATION = 1; // seconds the ship stays thrown by the bounce before regaining power
const TRIGGER_SHARPEN = 0.35; // turn-rate boost from the same-side trigger while turning that way
const TRIGGER_WIDEN = 0.3; // turn-rate cut from the opposite-side trigger while turning that way
const OFF_THROTTLE_SHARPEN = 0.35; // turn-rate boost when the accelerator isn't held
const SLIDE_SPEED = 180; // world units/sec of pure lateral strafe at full trigger
const DRIFT_STRENGTH = 140; // world units/sec of outward drift at drift stat 1.0, full steer/accelerate/speed

// Acceleration is a 3-zone piecewise-linear curve over absolute speed (SPD), not a smooth
// function: a fixed sharp rate for every ship up to 300 SPD, a rate set by the ship's own
// acceleration stat between 300 and 400 SPD, then a fixed slow rate from 400 up to top speed.
const ACCEL_ZONE1_END_SPEED = 300;
const ACCEL_ZONE2_END_SPEED = 400;
const ACCEL_ZONE1_RATE = 320; // fixed, all ships
const ACCEL_ZONE3_RATE = 10; // fixed, all ships

// Deceleration is a separate, fixed linear decline — the same rate for every ship regardless
// of their acceleration stat, unlike the zoned acceleration curve above.
const DECELERATION_RATE = 400; // SPD/sec while braking, all ships
const COAST_DRAG_RATE = 80; // SPD/sec while coasting (no input), all ships

export class Ship {
  x: number;
  z: number;
  /** Nose direction, radians. Forward = (sin(heading), cos(heading)). */
  heading: number;
  /** Direction the ship is actually moving, radians — trails `heading` under drift. */
  velAngle: number;
  speed = 0;
  health: number;

  lapCount = 0;
  currentLapTime = 0;
  lastLapTime: number | null = null;
  bestLapTime: number | null = null;

  private lastLapProgress = 0;
  private _offTrack = false;
  private stunned = false;
  private stunTimer = 0;

  constructor(readonly character: CharacterDef, track: TrackDef) {
    const start = pointAtProgress(track, 0);
    this.x = start.x;
    this.z = start.z;
    this.heading = Math.atan2(start.tangentX, start.tangentZ);
    this.velAngle = this.heading;
    this.health = character.stats.durability;
  }

  get isOffTrack(): boolean {
    return this._offTrack;
  }

  /** True for STUN_DURATION seconds after a hard wall bounce, until power comes back on its own. */
  get isStunned(): boolean {
    return this.stunned;
  }

  update(dt: number, input: InputState, track: TrackDef) {
    const stats = this.character.stats;

    // Recovery from a wall-bounce stun is purely time-based — the ship stays thrown by the
    // bounce for a fixed duration, then automatically regains forward momentum.
    if (this.stunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.stunned = false;
      }
    }

    const speedFrac = Math.max(0, Math.min(1, this.speed / stats.topSpeed));

    // Steering always responds, even while stunned — a wall bounce takes away power and
    // traction, not the player's ability to aim the nose.
    // Steering: nose turns responsively; tighter at low speed, looser at high speed (feels drifty).
    const turnRate = stats.handling * (1 - speedFrac * 0.4);

    // Triggers modulate turn radius: the trigger on the same side as the turn sharpens it,
    // the trigger on the opposite side widens it. Has no effect at all while going straight,
    // since it only scales a turn rate that's already being multiplied by zero steer input.
    const sameSideTrigger = input.steer < 0 ? input.leftTrigger : input.rightTrigger;
    const oppositeSideTrigger = input.steer < 0 ? input.rightTrigger : input.leftTrigger;
    // Easing off the accelerator tightens the turn radius (lets the nose come around faster).
    const offThrottleFactor = 1 + OFF_THROTTLE_SHARPEN * (1 - input.accelerate);
    const turnRadiusFactor = Math.max(
      0.2,
      (1 + sameSideTrigger * TRIGGER_SHARPEN - oppositeSideTrigger * TRIGGER_WIDEN) * offThrottleFactor,
    );
    this.heading += input.steer * turnRate * turnRadiusFactor * dt;

    // While stunned the ship is otherwise thrown by the bounce — no acceleration, braking,
    // drift-catchup, or slide input has any effect until control is regained above.
    if (!this.stunned) {
      // Acceleration / braking / boost.
      const boosting = input.boost;
      const targetTopSpeed = stats.topSpeed * (boosting ? stats.boostPower : 1);
      if (input.accelerate > 0) {
        // 3-zone piecewise-linear acceleration: a fixed sharp rate below 300 SPD (same for
        // every ship), the ship's own acceleration stat as the rate between 300 and 400 SPD,
        // then a fixed slow rate from 400 SPD up to top speed (same for every ship again).
        let accelRate: number;
        if (this.speed < ACCEL_ZONE1_END_SPEED) {
          accelRate = ACCEL_ZONE1_RATE;
        } else if (this.speed < ACCEL_ZONE2_END_SPEED) {
          accelRate = stats.acceleration;
        } else {
          accelRate = ACCEL_ZONE3_RATE;
        }
        this.speed += accelRate * input.accelerate * dt;
      }
      if (input.brake > 0) {
        this.speed -= DECELERATION_RATE * input.brake * dt;
      }
      if (!input.accelerate && !input.brake) {
        this.speed -= COAST_DRAG_RATE * dt; // coasting drag
      }
      this.speed = Math.max(0, Math.min(targetTopSpeed, this.speed));

      // Velocity direction catches up to heading over time — the source of the drift feel.
      const grip = GRIP_BASE * (0.5 + 0.5 * (1 - speedFrac));
      let angleDiff = this.heading - this.velAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      this.velAngle += Math.max(-grip * dt, Math.min(grip * dt, angleDiff));
    }

    this.x += Math.sin(this.velAngle) * this.speed * dt;
    this.z += Math.cos(this.velAngle) * this.speed * dt;

    // Cornering under power drifts the ship outward, away from the turn — the ship's own
    // drift stat sets how wide that drift is. No drift while coasting/braking, going
    // straight, standing still, or stunned.
    if (!this.stunned && input.steer !== 0 && input.accelerate > 0 && speedFrac > 0) {
      const driftLeftX = -Math.cos(this.velAngle);
      const driftLeftZ = Math.sin(this.velAngle);
      const driftDir = Math.sign(input.steer); // pushes toward the outside of the turn
      const driftMagnitude = stats.drift * DRIFT_STRENGTH * Math.abs(input.steer) * input.accelerate * speedFrac;
      this.x += driftLeftX * driftDir * driftMagnitude * dt;
      this.z += driftLeftZ * driftDir * driftMagnitude * dt;
    }

    // Trigger slide: a pure sideways strafe layered on top, independent of forward speed (the
    // `this.speed` value itself is never touched here) but scaled by how fast the ship is
    // currently going — no slide at a standstill, full slide distance at top speed.
    // Left trigger slides left, right trigger slides right.
    const slideInput = input.leftTrigger - input.rightTrigger;
    if (!this.stunned && slideInput !== 0 && speedFrac > 0) {
      const leftX = -Math.cos(this.velAngle);
      const leftZ = Math.sin(this.velAngle);
      this.x += leftX * slideInput * SLIDE_SPEED * speedFrac * dt;
      this.z += leftZ * slideInput * SLIDE_SPEED * speedFrac * dt;
    }

    // Track projection: on-track / off-track shoulder / solid wall at the shoulder's outer edge.
    const proj = projectToTrack(track, this.x, this.z);
    const half = proj.trackWidth / 2;
    const wallBoundary = half + WALL_MARGIN;
    const absLateral = Math.abs(proj.lateralOffset);
    this._offTrack = absLateral > half;

    if (absLateral > wallBoundary) {
      const normalX = -proj.tangentZ;
      const normalZ = proj.tangentX;
      const sign = Math.sign(proj.lateralOffset);
      const excess = absLateral - wallBoundary;
      this.x -= sign * normalX * excess;
      this.z -= sign * normalZ * excess;

      // Bounce off the wall: reflect the velocity component pointing into the wall, scaled
      // by the restitution. The reflected impulse is proportional to impact speed, so a
      // faster hit produces a harder bounce — no extra tuning needed for that to fall out.
      const outwardX = sign * normalX;
      const outwardZ = sign * normalZ;
      const velX = Math.sin(this.velAngle) * this.speed;
      const velZ = Math.cos(this.velAngle) * this.speed;
      const impactSpeed = velX * outwardX + velZ * outwardZ;
      if (impactSpeed > 0) {
        const newVelX = velX - (1 + WALL_RESTITUTION) * impactSpeed * outwardX;
        const newVelZ = velZ - (1 + WALL_RESTITUTION) * impactSpeed * outwardZ;
        this.speed = Math.hypot(newVelX, newVelZ);
        this.velAngle = Math.atan2(newVelX, newVelZ);
        // Only a hard enough hit stuns — a light graze just bounces off cleanly.
        if (impactSpeed >= STUN_IMPACT_SPEED) {
          this.stunned = true;
          this.stunTimer = STUN_DURATION;
        }
      }
    } else if (this._offTrack) {
      this.speed *= Math.max(0, 1 - OFF_TRACK_DRAG * dt);
    }

    this.updateLapTimer(dt, proj.lapProgress);
  }

  private updateLapTimer(dt: number, progress: number) {
    this.currentLapTime += dt;
    if (this.lastLapProgress > 0.9 && progress < 0.1) {
      this.lastLapTime = this.currentLapTime;
      if (this.bestLapTime === null || this.currentLapTime < this.bestLapTime) {
        this.bestLapTime = this.currentLapTime;
      }
      this.currentLapTime = 0;
      this.lapCount += 1;
    }
    this.lastLapProgress = progress;
  }
}
