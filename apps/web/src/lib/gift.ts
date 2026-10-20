// Bonus points a parent gifts a kid (SB-78), as plain data shared by the gift
// form, the remote function, the Rewards screen and the tests. No server
// imports: this is bundled into the client, and the same validation runs again
// on the server. The reason limit is under `points_ledger_note_check` (200).

export const MIN_GIFT_POINTS = 1;
export const MAX_GIFT_POINTS = 500;
/** Characters, after trimming. */
export const MAX_GIFT_REASON = 140;
/** The one-tap amounts on the gift form. */
export const QUICK_GIFT_AMOUNTS = [5, 10, 20, 50] as const;

export interface GiftInput {
	points: number;
	reason: string;
}

export type GiftParse =
	| { ok: true; value: GiftInput }
	| { ok: false; message: string };

/**
 * Checks what a parent typed. `points` may arrive as a string (form fields
 * are text) but must be a whole number: "12.5", "1e2" and " " are refused
 * rather than rounded.
 */
export function parseGiftInput(data: {
	points?: unknown;
	reason?: unknown;
}): GiftParse {
	const raw =
		typeof data.points === 'number' ? String(data.points) : data.points;
	const points =
		typeof raw === 'string' && /^\d+$/.test(raw.trim())
			? Number(raw.trim())
			: Number.NaN;
	if (
		!Number.isSafeInteger(points) ||
		points < MIN_GIFT_POINTS ||
		points > MAX_GIFT_POINTS
	) {
		return {
			ok: false,
			message: `Give a whole number of points from ${MIN_GIFT_POINTS} to ${MAX_GIFT_POINTS}.`,
		};
	}
	const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
	if (!reason) return { ok: false, message: 'Say what the points are for.' };
	if (reason.length > MAX_GIFT_REASON) {
		return {
			ok: false,
			message: `Keep the reason to ${MAX_GIFT_REASON} characters or fewer.`,
		};
	}
	return { ok: true, value: { points, reason } };
}

/** A gift as the kid sees it. */
export interface GiftItem {
	id: string;
	points: number;
	reason: string;
	/** Display name of the parent who gave it, or null if they've since left. */
	fromName: string | null;
	/** ISO timestamp. */
	createdAt: string;
}

/** "+20 · Helped Grandma with groceries · from Mom" */
export function giftLine(
	gift: Pick<GiftItem, 'points' | 'reason' | 'fromName'>,
) {
	const parts = [`+${gift.points}`, gift.reason];
	if (gift.fromName) parts.push(`from ${gift.fromName}`);
	return parts.join(' · ');
}

/**
 * One gift in the "You got bonus points!" moment (SB-83):
 * "+20 from Mom · Helped Grandma with groceries".
 */
export function giftMomentLine(
	gift: Pick<GiftItem, 'points' | 'reason' | 'fromName'>,
) {
	const amount = gift.fromName
		? `+${gift.points} from ${gift.fromName}`
		: `+${gift.points}`;
	return `${amount} · ${gift.reason}`;
}

/** All the points in the moment, for its big "+25 pts". */
export function giftMomentTotal(gifts: readonly Pick<GiftItem, 'points'>[]) {
	return gifts.reduce((sum, g) => sum + g.points, 0);
}

/** "Here are your 2 gifts." under the heading, or nothing for one. */
export function giftMomentSummary(gifts: readonly unknown[]) {
	return gifts.length > 1 ? `Here are your ${gifts.length} gifts.` : null;
}
