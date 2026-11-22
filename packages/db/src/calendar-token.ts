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
 * this before it touches the database, so random paths cost nothing.
 */
export function isCalendarToken(value: string): boolean {
	return CALENDAR_TOKEN.test(value);
}
