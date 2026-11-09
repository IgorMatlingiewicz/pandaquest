// Fewest completions for activity levels 1 to 4; level 0 is a day without any.
export const ACTIVITY_LEVEL_MIN = [1, 3, 5, 7] as const;

// Weeks in the activity calendar; the server always sends 26.
export const ACTIVITY_WEEKS = { narrow: 15, wide: 26 } as const;

// Calendar squares, in px. The size follows the width, within these bounds.
export const CELL_SIZE = { min: 10, max: 18 } as const;
export const CELL_GAP = 3;
// The column with the day names left of the squares.
export const DAY_LABEL_WIDTH = 28;
// Room a month name needs above the squares.
export const MONTH_LABEL_WIDTH = 28;

// Weekly XP bars, in px. A week with any XP is never thinner than the minimum.
export const BAR_MAX_HEIGHT = 140;
export const BAR_MIN_HEIGHT = 4;
