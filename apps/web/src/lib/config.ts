/**
 * Feature flags. Flip these on once the backing work has landed.
 */

/**
 * Shows the Google / Apple buttons on the sign-in and sign-up pages.
 * Keep this `false` until the OAuth providers are enabled in Neon Auth and the
 * `onchoose` handlers call `signIn.social({ provider })` (see SB-18 follow-up).
 */
export const SOCIAL_SIGN_IN_ENABLED = false;
