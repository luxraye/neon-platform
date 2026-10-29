/** httpOnly cookie holding the Firebase session cookie (the name Firebase Hosting forwards). */
export const SESSION_COOKIE = "__session";

/** Single-device lock: signing in elsewhere invalidates older sessions. */
export const SESSION_LOCK_COOKIE = "neon_session_lock";

/** How long a sign-in lasts before the user must sign in again. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
