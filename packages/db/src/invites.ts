import { createHash, randomBytes } from 'node:crypto';

/** How long a new invite stays valid by default (matches the column default). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hashes an invite token the way the database does: lowercase hex SHA-256 of
 * its UTF-8 bytes. Store this in `household_invites.token_hash`; never store
 * the token itself.
 */
export function hashInviteToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Makes a new invite token (32 random bytes, base64url) and its hash. Put the
 * token in the invite link and the hash in the row.
 */
export function createInviteToken(): { token: string; tokenHash: string } {
	const token = randomBytes(32).toString('base64url');
	return { token, tokenHash: hashInviteToken(token) };
}
