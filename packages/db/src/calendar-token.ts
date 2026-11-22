import { randomBytes } from 'node:crypto';

/** What a calendar token looks like: 32 random bytes as base64url, so 43 characters. */
const CALENDAR_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Makes a new household calendar token (SB-101): 32 random bytes, base64url.
 * It goes in the subscription link and in `household_calendar_tokens.token`.
 */
export function createCalendarToken(): string {
	return randomBytes(32).toString('base64url');
}

/**
 * Whether `value` has the shape of a calendar token. The feed route checks
 * this first, so malformed paths skip the database. Any 43 characters from the
 * alphabet pass, so it doesn't stop guessing or load: the token's entropy and
 * rate limiting do that.
 */
export function isCalendarToken(value: string): boolean {
	return CALENDAR_TOKEN.test(value);
}
