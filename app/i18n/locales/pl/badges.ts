const badges = {
  tiers: {
    BRONZE: "Brąz",
    SILVER: "Srebro",
    GOLD: "Złoto",
    DIAMOND: "Diament",
  },
  // Keyed like backend/src/badges/badges.config.ts.
  names: {
    daily_total: "Dzień za dniem",
    daily_streak: "Seria dzienna",
    weekly_total: "Tydzień za tygodniem",
    weekly_streak: "Seria tygodniowa",
    life_goal: "Cel życia",
    first_day: "Pierwszy dzień",
    first_week: "Pierwszy tydzień",
    bright_start: "Jasny początek",
    own_category_first_task: "Po swojemu",
    own_category_all_done: "Komplet",
    many_categories: "Dużo na głowie",
    streak_days: "Wytrwałość",
  },
  // {{count}} is the threshold of the tier being described. Polish picks
  // _one (1), _few (2-4, 22-24, ...) or _many (5-21, 25-31, ...); _other
  // only covers fractions, which thresholds never are.
  descriptions: {
    daily_total_one: "Zalicz łącznie {{count}} dzień",
    daily_total_few: "Zalicz łącznie {{count}} dni",
    daily_total_many: "Zalicz łącznie {{count}} dni",
    daily_total_other: "Zalicz łącznie {{count}} dni",
    daily_streak_one: "Zalicz {{count}} dzień z rzędu",
    daily_streak_few: "Zalicz {{count}} dni z rzędu",
    daily_streak_many: "Zalicz {{count}} dni z rzędu",
    daily_streak_other: "Zalicz {{count}} dni z rzędu",
    weekly_total_one: "Zalicz łącznie {{count}} tydzień",
    weekly_total_few: "Zalicz łącznie {{count}} tygodnie",
    weekly_total_many: "Zalicz łącznie {{count}} tygodni",
    weekly_total_other: "Zalicz łącznie {{count}} tygodnia",
    weekly_streak_one: "Zalicz {{count}} tydzień z rzędu",
    weekly_streak_few: "Zalicz {{count}} tygodnie z rzędu",
    weekly_streak_many: "Zalicz {{count}} tygodni z rzędu",
    weekly_streak_other: "Zalicz {{count}} tygodnia z rzędu",
    life_goal: "Ukończ cel życiowy",
    first_day: "Zalicz pierwszy pełny dzień (dzień rejestracji się nie liczy)",
    first_week: "Zalicz pierwszy pełny tydzień",
    bright_start: "Przejdź samouczek",
    own_category_first_task: "Ukończ zadanie z własnej kategorii",
    own_category_all_done:
      "Ukończ wszystkie zadania własnej kategorii w bieżącym okresie",
    many_categories_one: "Miej {{count}} własną kategorię",
    many_categories_few: "Miej {{count}} własne kategorie",
    many_categories_many: "Miej {{count}} własnych kategorii",
    many_categories_other: "Miej {{count}} własnej kategorii",
    streak_days_one: "Wytrwaj {{count}} dzień w jednym ciągu",
    streak_days_few: "Wytrwaj {{count}} dni w jednym ciągu",
    streak_days_many: "Wytrwaj {{count}} dni w jednym ciągu",
    streak_days_other: "Wytrwaj {{count}} dnia w jednym ciągu",
  },
};

export default badges;
