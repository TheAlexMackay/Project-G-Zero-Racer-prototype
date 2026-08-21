import type { CharacterDef } from "./types";

/** The Milestone 1 default playable character. The full 6-character roster arrives in Milestone 2. */
export const DEFAULT_CHARACTER: CharacterDef = {
  id: "falcon",
  name: "Falcon",
  stats: {
    topSpeed: 450,
    acceleration: 50,
    handling: 2.6,
    boostPower: 1.6,
    durability: 100,
    weight: 1.0,
    drift: 3.75,
  },
  colors: {
    primary: "#2f6fe0",
    secondary: "#e8e8f0",
    accent: "#ffce3d",
  },
};
