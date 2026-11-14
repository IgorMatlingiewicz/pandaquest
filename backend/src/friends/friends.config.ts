/** After a decline, how long the one who asked must wait to ask again. */
export const RESEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Pending requests one user may have sent and not had answered yet. */
export const MAX_PENDING_OUTGOING = 20;

/** Friends one user may have; checked for both sides of a new friendship. */
export const MAX_FRIENDS = 100;
