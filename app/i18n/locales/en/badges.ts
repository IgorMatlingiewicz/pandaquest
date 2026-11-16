import type pl from "../pl/badges";

const badges: typeof pl = {
  tiers: {
    BRONZE: "Bronze",
    SILVER: "Silver",
    GOLD: "Gold",
    DIAMOND: "Diamond",
  },
  names: {
    daily_total: "Day after day",
    daily_streak: "Daily streak",
    weekly_total: "Week after week",
    weekly_streak: "Weekly streak",
    life_goal: "Life goal",
    first_day: "First day",
    first_week: "First week",
    bright_start: "Bright Start",
    own_category_first_task: "My own way",
    own_category_all_done: "Full set",
    many_categories: "A lot on my plate",
    streak_days: "Perseverance",
  },
  // English only uses _one and _other; _few and _many exist because both
  // languages share one shape (typeof pl) and are never picked here.
  descriptions: {
    daily_total_one: "Complete {{count}} day in total",
    daily_total_few: "Complete {{count}} days in total",
    daily_total_many: "Complete {{count}} days in total",
    daily_total_other: "Complete {{count}} days in total",
    daily_streak_one: "Complete {{count}} day in a row",
    daily_streak_few: "Complete {{count}} days in a row",
    daily_streak_many: "Complete {{count}} days in a row",
    daily_streak_other: "Complete {{count}} days in a row",
    weekly_total_one: "Complete {{count}} week in total",
    weekly_total_few: "Complete {{count}} weeks in total",
    weekly_total_many: "Complete {{count}} weeks in total",
    weekly_total_other: "Complete {{count}} weeks in total",
    weekly_streak_one: "Complete {{count}} week in a row",
    weekly_streak_few: "Complete {{count}} weeks in a row",
    weekly_streak_many: "Complete {{count}} weeks in a row",
    weekly_streak_other: "Complete {{count}} weeks in a row",
    life_goal: "Complete a life goal",
    first_day:
      "Complete your first full day (the day you sign up does not count)",
    first_week: "Complete your first full week",
    bright_start: "Complete the tutorial",
    own_category_first_task: "Complete a task from your own category",
    own_category_all_done:
      "Complete every task of your own category in the current period",
    many_categories_one: "Have {{count}} category of your own",
    many_categories_few: "Have {{count}} categories of your own",
    many_categories_many: "Have {{count}} categories of your own",
    many_categories_other: "Have {{count}} categories of your own",
    streak_days_one: "Keep one quit streak going for {{count}} day",
    streak_days_few: "Keep one quit streak going for {{count}} days",
    streak_days_many: "Keep one quit streak going for {{count}} days",
    streak_days_other: "Keep one quit streak going for {{count}} days",
  },
};

export default badges;
