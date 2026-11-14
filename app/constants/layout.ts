// From this window width up the layout is "wide": two columns of cards.
// Tailwind's `md`.
export const WIDE_SCREEN = 768;

// From this width up the page links sit in the top bar next to the title;
// below it they are in the burger menu. Wider than WIDE_SCREEN: five links,
// the user's name and the settings did not fit at 768 (found with the
// friends link, on the web).
export const NAV_INLINE = 1024;

// The user's name in the top bar is cut with "…" past this width: a name has
// no length limit, and a long one would push the links off the screen.
export const TOP_BAR_NAME_MAX_WIDTH = 160;
