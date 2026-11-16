import type pl from "../pl/stats";

const stats: typeof pl = {
  loadError: "Couldn't load your statistics.",
  retry: "Try again",
  empty: "Complete your first task and your activity will show up here.",
  // _few and _many as in badges.descriptions: never picked in English.
  tiles: {
    fullDays: "Full days",
    streak: "Streak",
    xpMonth: "XP this month",
    completionsMonth: "Tasks done (this month)",
    days_one: "{{count}} day",
    days_few: "{{count}} days",
    days_many: "{{count}} days",
    days_other: "{{count}} days",
    record: "best {{count}}",
  },
  activity: {
    title: "Activity",
    less: "Less",
    more: "More",
    fullDay: "full day",
    completions_one: "{{count}} task",
    completions_few: "{{count}} tasks",
    completions_many: "{{count}} tasks",
    completions_other: "{{count}} tasks",
    details: "{{date}} · {{completions}}",
    detailsFullDay: "{{date}} · {{completions}} · full day",
    cell: "{{date}}, {{completions}}",
    cellFullDay: "{{date}}, {{completions}}, full day",
  },
  weeklyXp: {
    title: "Weekly XP",
    empty: "No XP in the last 8 weeks",
    bar: "Week of {{date}}: {{xp}} XP",
  },
};

export default stats;
