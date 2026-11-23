const xp = {
  level: "Poziom {{level}}",
  progress: "{{current}} / {{total}} XP",
  maxLevel: "Maksymalny poziom",
  // "XP" does not change with the number, so no plural forms are needed.
  toNext: "{{xp}} XP do poziomu {{level}}",
  // What a screen reader says for the bar.
  barValue: "{{current}} z {{total}} XP, {{xp}} XP do poziomu {{level}}",
  gained: "+{{amount}} XP",
  gainedWithMultiplier: "+{{amount}} XP (×{{multiplier}})",
};

export default xp;
