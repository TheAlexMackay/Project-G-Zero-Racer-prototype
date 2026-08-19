export interface InputState {
  /** -1 (full left) .. 1 (full right) */
  steer: number;
  /** 0 .. 1 */
  accelerate: number;
  /** 0 .. 1 */
  brake: number;
  boost: boolean;
  /** 0 .. 1: gamepad left trigger (analog) or the Q key (digital) — drives the slide/turn-radius mechanic. */
  leftTrigger: number;
  /** 0 .. 1: gamepad right trigger (analog) or the E key (digital) — drives the slide/turn-radius mechanic. */
  rightTrigger: number;
}

const STEER_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const STEER_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const ACCEL_KEYS = ["ArrowUp", "KeyW"];
const BRAKE_KEYS = ["ArrowDown", "KeyS"];
const BOOST_KEYS = ["Space", "ShiftLeft", "ShiftRight"];
const LEFT_TRIGGER_KEYS = ["KeyQ"];
const RIGHT_TRIGGER_KEYS = ["KeyE"];

const GAMEPAD_AXIS_DEADZONE = 0.15;
const GAMEPAD_TRIGGER_DEADZONE = 0.08;

// Standard gamepad mapping: 0 = bottom face (A/Cross), 1 = right face (B/Circle),
// 3 = top face (Y/Triangle), 6/7 = left/right analog triggers (L2/R2).
const GAMEPAD_ACCEL_BUTTON = 0;
const GAMEPAD_BRAKE_BUTTON = 1;
const GAMEPAD_BOOST_BUTTON = 3;
const GAMEPAD_LEFT_TRIGGER = 6;
const GAMEPAD_RIGHT_TRIGGER = 7;

/** Unifies keyboard and Gamepad API (polled once per frame) into one InputState. */
export class InputManager {
  private pressedKeys = new Set<string>();
  readonly state: InputState = {
    steer: 0,
    accelerate: 0,
    brake: 0,
    boost: false,
    leftTrigger: 0,
    rightTrigger: 0,
  };

  constructor() {
    window.addEventListener("keydown", (e) => this.pressedKeys.add(e.code));
    window.addEventListener("keyup", (e) => this.pressedKeys.delete(e.code));
    window.addEventListener("blur", () => this.pressedKeys.clear());
  }

  private anyPressed(codes: string[]): boolean {
    return codes.some((c) => this.pressedKeys.has(c));
  }

  /** Rescales past the deadzone so noisy/imperfectly-calibrated triggers rest at exactly 0. */
  private applyTriggerDeadzone(value: number): number {
    if (value <= GAMEPAD_TRIGGER_DEADZONE) return 0;
    return (value - GAMEPAD_TRIGGER_DEADZONE) / (1 - GAMEPAD_TRIGGER_DEADZONE);
  }

  /** Call once per frame before reading `state`. */
  update() {
    let steer = 0;
    let accelerate = this.anyPressed(ACCEL_KEYS) ? 1 : 0;
    let brake = this.anyPressed(BRAKE_KEYS) ? 1 : 0;
    let boost = this.anyPressed(BOOST_KEYS);
    let leftTrigger = this.anyPressed(LEFT_TRIGGER_KEYS) ? 1 : 0;
    let rightTrigger = this.anyPressed(RIGHT_TRIGGER_KEYS) ? 1 : 0;

    if (this.anyPressed(STEER_LEFT_KEYS)) steer -= 1;
    if (this.anyPressed(STEER_RIGHT_KEYS)) steer += 1;

    const gamepad = this.getActiveGamepad();
    if (gamepad) {
      const axisX = gamepad.axes[0] ?? 0;
      if (Math.abs(axisX) > GAMEPAD_AXIS_DEADZONE) {
        steer = Math.max(-1, Math.min(1, steer + axisX));
      }
      if (gamepad.buttons[GAMEPAD_ACCEL_BUTTON]?.pressed) accelerate = 1;
      if (gamepad.buttons[GAMEPAD_BRAKE_BUTTON]?.pressed) brake = 1;
      boost = boost || (gamepad.buttons[GAMEPAD_BOOST_BUTTON]?.pressed ?? false);

      // Trigger button indices are only meaningful under the W3C "standard" mapping — on a
      // non-standard controller, index 6/7 could be wired to anything, so leave them at
      // whatever the keyboard already contributed rather than risk reading a phantom trigger.
      if (gamepad.mapping === "standard") {
        const gamepadLeftTrigger = this.applyTriggerDeadzone(gamepad.buttons[GAMEPAD_LEFT_TRIGGER]?.value ?? 0);
        const gamepadRightTrigger = this.applyTriggerDeadzone(gamepad.buttons[GAMEPAD_RIGHT_TRIGGER]?.value ?? 0);
        leftTrigger = Math.max(leftTrigger, gamepadLeftTrigger);
        rightTrigger = Math.max(rightTrigger, gamepadRightTrigger);
      }
    }

    this.state.steer = Math.max(-1, Math.min(1, steer));
    this.state.accelerate = Math.max(0, Math.min(1, accelerate));
    this.state.brake = Math.max(0, Math.min(1, brake));
    this.state.boost = boost;
    this.state.leftTrigger = leftTrigger;
    this.state.rightTrigger = rightTrigger;
  }

  private getActiveGamepad(): Gamepad | null {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (pad) return pad;
    }
    return null;
  }
}
