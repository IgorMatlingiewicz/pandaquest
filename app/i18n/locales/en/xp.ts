import type pl from "../pl/xp";

const xp: typeof pl = {
  level: "Level {{level}}",
  progress: "{{current}} / {{total}} XP",
  maxLevel: "Max level",
  toNext: "{{xp}} XP to level {{level}}",
  barValue: "{{current}} of {{total}} XP, {{xp}} XP to level {{level}}",
  gained: "+{{amount}} XP",
  gainedWithMultiplier: "+{{amount}} XP (×{{multiplier}})",
};

export default xp;
