import type pl from "../pl/achievements";

const achievements: typeof pl = {
  summary: "Badges earned: {{earned}} of {{total}}",
  progress: "{{current}} / {{target}}",
  next: "Next: {{tier}} · +{{xp}} XP",
  max: "MAX",
  notYet: "Not earned yet",
  earnedOn: "{{tier}} · earned {{date}}",
  loadError: "Couldn't load your achievements.",
  retry: "Try again",
};

export default achievements;
