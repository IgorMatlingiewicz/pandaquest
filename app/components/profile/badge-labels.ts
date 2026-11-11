import type { TFunction } from "i18next";
import type { BadgeTier } from "@/types/api";

// Names as the achievements screen shows them; a badge the app has no text
// for yet still shows its key rather than nothing.
export const badgeName = (t: TFunction, key: string) =>
  t(`badges.names.${key}`, { defaultValue: key });

export const tierName = (t: TFunction, tier: BadgeTier) =>
  t(`badges.tiers.${tier}`);
