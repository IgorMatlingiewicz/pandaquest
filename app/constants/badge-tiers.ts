import type { BadgeTier } from "@/types/api";

// Lowest first, as the backend's BadgeTier enum and GET /achievements order
// them.
export const TIER_ORDER: readonly BadgeTier[] = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "DIAMOND",
];

// Medal colors, readable on both the light and the dark theme.
export const TIER_COLORS: Record<BadgeTier, string> = {
  BRONZE: "#cd7f32",
  SILVER: "#9ca3af",
  GOLD: "#eab308",
  DIAMOND: "#38bdf8",
};
