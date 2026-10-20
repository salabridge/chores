import { sql } from 'drizzle-orm';
import type { AuthenticatedTx } from './authenticated-db.ts';

// The "You got bonus points!" moment (SB-83). A kid's gifts are the
// `points_ledger` rows with `adjustment_kind = 'gift'`; the ones after their
// `household_members.gifts_seen_at` are unseen. See "Bonus points" in
// ../README.md.

/**
 * Marks the gifts the moment showed (`giftIds`) as seen for `memberId`, when
 * the kid dismisses it. `gifts_seen_at` moves forward to the newest of them,
 * never back, so a gift that arrived while the moment was open stays unseen.
 * Ids that aren't the member's gifts are ignored. Only the member's own login
 * can do it (42501 otherwise, including a parent acting as a managed kid).
 * Returns the new `gifts_seen_at`.
 */
export async function markGiftsSeen(
	tx: AuthenticatedTx,
	memberId: string,
	giftIds: readonly string[],
): Promise<Date | null> {
	const ids = sql.join(
		giftIds.map((id) => sql`${id}`),
		sql`, `,
	);
	const { rows } = await tx.execute<{ seen: string | Date | null }>(
		sql`select app.mark_gifts_seen(${memberId}::uuid, array[${ids}]::uuid[]) as seen`,
	);
	const seen = rows[0]?.seen ?? null;
	return seen ? new Date(seen) : null;
}
