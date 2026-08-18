export interface CharacterStats {
  /** World units / second. */
  topSpeed: number;
  /** World units / second^2. */
  acceleration: number;
  /** Turn rate in radians/second at full speed. */
  handling: number;
  /** Speed multiplier applied while boosting. */
  boostPower: number;
  /** Max health / energy. */
  durability: number;
  /** Collision knockback resistance; higher = pushes others more, gets pushed less. */
  weight: number;
  /** Outward drift radius while turning under power; higher = wider drift. */
  drift: number;
}

export interface CharacterColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  stats: CharacterStats;
  colors: CharacterColors;
}
